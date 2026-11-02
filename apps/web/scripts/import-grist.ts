/**
 * Importe un document Grist dans PostgreSQL. LECTURE SEULE côté Grist : aucune écriture, aucune
 * modification de webhook. Rejouable (mise à jour par `grist_id`), sans doublon.
 *
 *   npx tsx scripts/import-grist.ts [--replace] [--allow-remote-target] [--keep-pending-notifications]
 *
 * Source : GRIST_BASE_URL / GRIST_DOC_ID / GRIST_API_KEY (DEV par défaut dans `.env.local`).
 * Cible : DATABASE_URL, qui doit être locale sauf `--allow-remote-target`.
 * `--replace` vide d'abord les tables métier de la cible (jamais sur une cible distante).
 *
 * Par défaut, les courriers de publication, de validation… dont l'état est déjà atteint dans Grist sont
 * marqués « déjà envoyés », pour qu'une première modification ne renvoie pas tout l'historique.
 */
import { sql, type SQL } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { createDatabase } from '../src/server/db/client';
import * as s from '../src/server/db/schema';
import { CATEGORIE_ACHETEUR_LABELS, STATUT_DECLARATION_LABELS, STATUT_MARCHE_LABELS, codeFromLabel } from '../src/server/db/labels';
import { GristClient, type Row } from '../src/server/grist/client';
import { enregistrerFichier } from '../src/server/services/fichiers';

process.loadEnvFile('.env.local');
const args = new Set(process.argv.slice(2));
const replace = args.has('--replace');
const keepPending = args.has('--keep-pending-notifications');

const target = new URL(process.env.DATABASE_URL!);
const local = ['localhost', '127.0.0.1', 'db'].includes(target.hostname);
if (!local && !args.has('--allow-remote-target')) {
  console.error(`Refus : la cible ${target.hostname} n'est pas locale (--allow-remote-target pour l'accepter).`);
  process.exit(1);
}
if (replace && !local) {
  console.error('Refus : --replace est interdit sur une cible distante.');
  process.exit(1);
}

const g = new GristClient({ baseUrl: process.env.GRIST_BASE_URL!, docId: process.env.GRIST_DOC_ID!, apiKey: process.env.GRIST_API_KEY! });
const { db, sql: pg } = createDatabase(process.env.DATABASE_URL!, { max: 4 });

/* ------------------------------------------------------------------ Outils ---------------- */

const warnings: string[] = [];
const warn = (m: string) => warnings.push(m);
/** Avertissements répétitifs : regroupés en une ligne avec quelques exemples. */
const groups = new Map<string, string[]>();
const warnGroup = (title: string, example: string) => groups.set(title, [...(groups.get(title) ?? []), example]);
const plain = (v: unknown) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/^(la|le|les) /, '').trim();
const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const ref = (v: unknown): number | null => (typeof v === 'number' && v > 0 ? v : null);
const bool = (v: unknown): boolean => v === true || v === 1;
const ids = (v: unknown): number[] => (Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number') : []);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x !== 'L') : []);
const when = (v: unknown): Date | null => (typeof v === 'number' && v > 0 ? new Date(v * 1000) : null);
const day = (v: unknown): string | null => when(v)?.toISOString().slice(0, 10) ?? null;
const email = (v: unknown): string | null => {
  const t = text(v)?.toLowerCase();
  return t && t.includes('@') ? t : null;
};
const counts: Record<string, { source: number; cible: number }> = {};
const read = async (table: string) => {
  const rows = await g.records(table);
  counts[table] = { source: rows.length, cible: 0 };
  return rows;
};

/** Insère ou met à jour par `grist_id` ; renvoie la correspondance identifiant Grist -> identifiant PostgreSQL. */
async function upsert(label: string, table: PgTable, rows: Record<string, unknown>[], source = label): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  const snake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const keys = Object.keys(chunk[0] ?? {}).filter((k) => k !== 'gristId');
    const set: Record<string, SQL> = {};
    for (const k of keys) set[k] = sql.raw(`excluded."${snake(k)}"`);
    const out = (await db
      .insert(table as never)
      .values(chunk as never)
      .onConflictDoUpdate({ target: (table as unknown as Record<string, never>).gristId, set } as never)
      .returning({ id: (table as unknown as Record<string, never>).id, gristId: (table as unknown as Record<string, never>).gristId } as never)) as unknown as { id: number; gristId: number }[];
    for (const r of out) map.set(r.gristId, r.id);
  }
  if (counts[source]) counts[source]!.cible = map.size;
  else counts[label] = { source: rows.length, cible: map.size };
  return map;
}

const mapped = (m: Map<number, number>, v: unknown): number | null => {
  const id = ref(v);
  return id ? (m.get(id) ?? null) : null;
};

/* ------------------------------------------------------------------ Import ---------------- */

async function main() {
  console.log(`Source : document ${process.env.GRIST_DOC_ID} sur ${new URL(process.env.GRIST_BASE_URL!).hostname} (lecture seule)`);
  console.log(`Cible  : ${target.hostname}:${target.port}${target.pathname}${replace ? ' (remplacement)' : ''}\n`);

  if (replace) {
    await db.execute(sql`truncate acheteurs, utilisateurs, clauses_sociales, formations, regions, departements, specialites, faq_categories, faq_questions, support_videos, impacts, liens, parametres, notifications_envoyees, fichiers restart identity cascade`);
  }

  // --- Référentiels -------------------------------------------------------------------------
  const formations = await upsert('T0_Referentiel_Formations', s.formations, (await read('T0_Referentiel_Formations')).map((r) => ({ gristId: r.id, intitule: text(r.Intitule) ?? `Formation ${r.id}` })));
  const regions = await upsert('T0_Referentiel_Regions', s.regions, (await read('T0_Referentiel_Regions')).map((r) => ({ gristId: r.id, intitule: text(r.Intitule) ?? `Région ${r.id}`, chefLieu: text(r.Chef_lieux), latitude: num(r.Latitude), longitude: num(r.Longitude), adresseGeocodee: text(r.Adresse_geocodee) })));
  const regionByName = new Map<string, number>();
  for (const r of await db.select().from(s.regions)) regionByName.set(plain(r.intitule), r.id);
  const departements = await upsert(
    'T0_Referentiel_Departements',
    s.departements,
    (await read('T0_Referentiel_Departements')).map((r) => {
      const regionName = text(r.Region) ? plain(r.Region) : null;
      if (regionName && !regionByName.has(regionName)) warnGroup('Départements dont la région est inconnue du référentiel des régions', `${r.Departement_Numero} (« ${r.Region} »)`);
      return {
        gristId: r.id,
        numero: text(r.Departement_Numero) ?? `?${r.id}`,
        nom: text(r.Departement_Nom) ?? `Département ${r.id}`,
        regionId: regionName ? (regionByName.get(regionName) ?? null) : null,
        libelleAffichage: text(r.Affichage),
        chefLieu: text(r.Chef_lieu),
        villesPrincipales: text(r.Villes_Principales),
        superficieKm2: num(r.Superficie_km2_),
        population2023: num(r.Population_2023_),
        densiteHabKm2: num(r.Densite_hab_km2_),
        latitude: num(r.Latitude),
        longitude: num(r.Longitude),
        adresseGeocodee: text(r.Adresse_geocodee),
      };
    }),
  );
  const clauses = await upsert('Clauses_sociales', s.clausesSociales, (await read('Clauses_sociales')).map((r) => ({ gristId: r.id, nom: text(r.Nom_de_la_clause) ?? `Clause ${r.id}`, gabaritArticle: text(r.Gabarit_d_article_de_marche), gabaritAnnuaireHtml: text(r.html_gabarit_annuaire_clause) })));
  const specialites = await upsert('T0_Referentiel_Specialites', s.specialites, (await read('T0_Referentiel_Specialites')).map((r) => ({ gristId: r.id, intitule: text(r.Intitule) ?? `Spécialité ${r.id}`, clauseId: mapped(clauses, r.Clause_sociale), infobulle: text(r.Tooltip) })));

  // --- Comptes ------------------------------------------------------------------------------
  const authUsers = new Map<string, Row>();
  for (const r of await read('Application_AuthUser')) {
    const e = email(r.Email);
    if (e) authUsers.set(e, r);
  }
  const userIds = new Map<string, number>();
  const usedAuth = new Set<string>();
  async function user(raw: unknown, context: string): Promise<number | null> {
    const e = email(raw);
    if (!e) return null;
    const cached = userIds.get(e);
    if (cached) return cached;
    const auth = authUsers.get(e);
    if (auth) usedAuth.add(e);
    const values = {
      email: e,
      motDePasseHash: text(auth?.Hash_Password),
      motDePasseModifieLe: when(auth?.Derniere_mise_a_jour),
      derniereConnexionLe: when(auth?.Derniere_connexion),
    };
    const [existing] = await db.select({ id: s.utilisateurs.id }).from(s.utilisateurs).where(sql`lower(${s.utilisateurs.email}) = ${e}`);
    let id = existing?.id;
    if (id) await db.update(s.utilisateurs).set(values).where(sql`${s.utilisateurs.id} = ${id}`);
    else id = (await db.insert(s.utilisateurs).values(values).returning({ id: s.utilisateurs.id }))[0]!.id;
    userIds.set(e, id);
    void context;
    return id;
  }

  /** Un compte ne peut porter qu'un profil de chaque type : un doublon d'e-mail dans Grist n'obtient pas de compte. */
  const taken = { acheteur: new Set<number>(), repondant: new Set<number>(), beneficiaire: new Set<number>() };
  const claim = (kind: keyof typeof taken, uid: number | null, what: string): number | null => {
    if (!uid) return null;
    if (taken[kind].has(uid)) {
      warn(`${what} : même adresse e-mail qu'un autre profil du même type, importé sans compte (doublon à fusionner dans Grist)`);
      return null;
    }
    taken[kind].add(uid);
    return uid;
  };

  // --- Acteurs ------------------------------------------------------------------------------
  const acheteurs = await upsert(
    'Acheteurs',
    s.acheteurs,
    (await read('Acheteurs')).map((r) => {
      const categorie = codeFromLabel(CATEGORIE_ACHETEUR_LABELS, r.Categorie);
      if (text(r.Categorie) && !categorie) warn(`Acheteur ${r.id} : catégorie « ${r.Categorie} » inconnue`);
      return { gristId: r.id, nom: text(r.Nom) ?? `Acheteur ${r.id}`, ministere: text(r.Ministere), categorie: categorie ?? null };
    }),
  );

  const uaRows: Record<string, unknown>[] = [];
  for (const r of await read('Utilisateurs_Acheteurs')) {
    const uid = await user(r.Email, 'utilisateur acheteur');
    const acheteurId = mapped(acheteurs, r.Entite_de_rattachement);
    if (!uid || !acheteurId) {
      warn(`Utilisateur acheteur ${r.id} ignoré : ${!uid ? 'e-mail absent' : 'entité absente'}`);
      continue;
    }
    uaRows.push({ gristId: r.id, utilisateurId: claim('acheteur', uid, `Utilisateur acheteur ${r.id}`) ?? uid, acheteurId, nom: text(r.Nom) ?? '—', prenom: text(r.Prenom) });
  }
  await upsert('Utilisateurs_Acheteurs', s.utilisateursAcheteurs, uaRows);

  const repRows: Record<string, unknown>[] = [];
  const grRepondants = await read('Repondants');
  for (const r of grRepondants) {
    const uid = await user(r.Email, 'répondant');
    if (!uid && !when(r.Date_de_suppression)) warn(`Répondant ${r.id} sans e-mail : importé sans compte`);
    repRows.push({ gristId: r.id, utilisateurId: claim('repondant', uid, `Répondant ${r.id}`), nom: text(r.Nom), prenom: text(r.Prenom), telephone: text(r.Telephone), raisonSociale: text(r.Raison_sociale), siret: text(r.Siret), anonymiseLe: day(r.Date_de_suppression) });
  }
  const repondants = await upsert('Repondants', s.repondants, repRows);

  // --- Bénéficiaires ------------------------------------------------------------------------
  const grBenef = await read('Beneficiaires');
  const benefRows: Record<string, unknown>[] = [];
  for (const r of grBenef) {
    const uid = await user(r.Courriel, 'bénéficiaire');
    const annee = text(r.Annee_de_diplome) ? Number.parseInt(String(r.Annee_de_diplome), 10) : null;
    if (text(r.Annee_de_diplome) && !Number.isInteger(annee)) warn(`Bénéficiaire ${r.id} : année de diplôme illisible (« ${r.Annee_de_diplome} »)`);
    if (!uid && !when(r.Date_de_suppression)) warnGroup('Bénéficiaires sans e-mail : importés sans compte (l’annuaire les affiche, ils ne peuvent pas se connecter)', String(r.id));
    benefRows.push({
      gristId: r.id,
      utilisateurId: claim('beneficiaire', uid, `Bénéficiaire ${r.id}`),
      nom: text(r.NOM) ?? `Bénéficiaire ${r.id}`,
      prenom: text(r.Prenom),
      telephone: text(r.Telephone),
      formationId: mapped(formations, r.Formation),
      autreFormation: text(r.Autre_Formation),
      anneeDiplome: Number.isInteger(annee) ? annee : null,
      specialiteEcole: text(r.Specialite_ecole),
      sousSpecialite: text(r.Sous_specialite),
      intituleMemoire: text(r.Intitule_du_memoire),
      autresInformations: text(r.Autres_informations),
      missionsProposees: text(r.Missions_proposees),
      commentaire: text(r.Commentaire),
      consentementAnnuaire: bool(r.Je_consens_a_figurer_dans_l_annuaire_partage_avec_les_professionnels_du_secteur),
      consentementContactGroupements: bool(r.Je_consens_a_etre_contacte_pour_rejoindre_des_groupements),
      alumni: bool(r.alumni),
      ficheAJour: bool(r.Fiche_MAJ),
      anonymiseLe: day(r.Date_de_suppression),
    });
  }
  const beneficiaires = await upsert('Beneficiaires', s.beneficiaires, benefRows);

  const joins = async (rows: { b: number; o: number }[], table: PgTable, ownerKey: string, otherKey: string) => {
    for (let i = 0; i < rows.length; i += 1000) {
      const chunk = rows.slice(i, i + 1000).map((x) => ({ [ownerKey]: x.b, [otherKey]: x.o }));
      if (chunk.length) await db.insert(table as never).values(chunk as never).onConflictDoNothing();
    }
  };
  const listJoin = (src: Row[], field: string, owners: Map<number, number>, others: Map<number, number>, what: string) =>
    src.flatMap((r) =>
      ids(r[field]).flatMap((o) => {
        const b = owners.get(r.id);
        const t = others.get(o);
        if (!b || !t) {
          warn(`${what} : référence ${o} introuvable pour la ligne ${r.id}`);
          return [];
        }
        return [{ b, o: t }];
      }),
    );
  await joins(listJoin(grBenef, 'Specialite', beneficiaires, specialites, 'Bénéficiaire.Spécialité'), s.beneficiaireSpecialites, 'beneficiaireId', 'specialiteId');
  await joins(listJoin(grBenef, 'Departement_de_residence', beneficiaires, departements, 'Bénéficiaire.Département'), s.beneficiaireDepartements, 'beneficiaireId', 'departementId');
  await joins(listJoin(grBenef, 'Regions_ou_vous_etes_mobile', beneficiaires, regions, 'Bénéficiaire.Région'), s.beneficiaireRegions, 'beneficiaireId', 'regionId');
  await joins(listJoin(grBenef, 'Clauses_sociales_de_rattachement', beneficiaires, clauses, 'Bénéficiaire.Clause'), s.beneficiaireClauses, 'beneficiaireId', 'clauseId');

  // CV : le premier fichier de la pièce jointe, copié dans le stockage configuré.
  let cvs = 0;
  for (const r of grBenef) {
    const att = ids(r.curriculum_vitae)[0];
    const bid = beneficiaires.get(r.id);
    if (!att || !bid) continue;
    const [b] = await db.select({ cv: s.beneficiaires.cvFichierId }).from(s.beneficiaires).where(sql`${s.beneficiaires.id} = ${bid}`);
    if (b?.cv) continue;
    try {
      const meta = await g.attachmentMeta(att);
      const res = await g.downloadAttachment(att);
      const bytes = new Uint8Array(await res.arrayBuffer());
      const f = await enregistrerFichier({ contenu: bytes, nom: meta.fileName, typeMime: res.headers.get('content-type') ?? 'application/octet-stream', usage: 'cv', utilisateurId: null });
      await db.update(s.beneficiaires).set({ cvFichierId: f.id }).where(sql`${s.beneficiaires.id} = ${bid}`);
      cvs++;
    } catch (e) {
      warnGroup('CV non copiés (pièce jointe illisible côté Grist)', `bénéficiaire ${r.id} / pièce ${att} (${e instanceof Error ? e.message.replace(/^.*: (\d{3})$/, 'HTTP $1') : e})`);
    }
  }
  counts['curriculum_vitae (fichiers)'] = { source: grBenef.filter((r) => ids(r.curriculum_vitae).length).length, cible: cvs };

  // --- Marchés (parents d'abord, puis lots) -------------------------------------------------
  const grMarches = await read('Marches');
  const marches = new Map<number, number>();
  const marcheRow = (r: Row, parentId: number | null) => {
    const statut = codeFromLabel(STATUT_MARCHE_LABELS, r.Statut);
    if (!statut) warn(`Marché ${r.id} : statut « ${r.Statut} » inconnu, remplacé par « en attente de notification »`);
    const acheteurId = mapped(acheteurs, r.Acheteur);
    if (!acheteurId) throw new Error(`Marché ${r.id} sans entité acheteuse`);
    return {
      gristId: r.id,
      parentId,
      acheteurId,
      intitule: text(r.Intitule_du_marche) ?? `Marché ${r.id}`,
      numeroLot: text(r.Numero_de_lot),
      intituleLot: text(r.Intitule_du_lot),
      clauseId: mapped(clauses, r.Clauses_sociales),
      statut: statut ?? 'en_attente_notification',
      titulaireId: mapped(repondants, r.Titulaire),
      lienDocuments: text(r.Lien_vers_les_documents_de_consultation),
      datePublication: day(r.Date_de_publication),
      dateLimiteOffres: day(r.Date_Limite_de_Remise_des_Offres),
      dateNotificationPrevisionnelle: day(r.Date_de_notification_previsionnelle),
      dateFinExecution: day(r.Date_de_fin_d_execution),
      lieuExecution: text(r.Lieu_d_execution),
      latitude: num(r.Latitude) || null,
      longitude: num(r.Longitude) || null,
      adresseGeocodee: text(r.Adresse_geocodee),
      lotsLieuxDifferents: bool(r.Lots_avec_lieux_differents),
      lotsClausesDifferentes: bool(r.Lots_avec_clauses_differentes),
      suivi: strs(r.Suivi),
      creationEnAutonomie: bool(r.Creation_en_autonomie),
    };
  };
  const parents = grMarches.filter((r) => !ref(r.Marche_parent));
  const parentIds = await upsert('Marches', s.marches, parents.map((r) => marcheRow(r, null)));
  for (const [k, v] of parentIds) marches.set(k, v);
  const lots = grMarches.filter((r) => ref(r.Marche_parent));
  const lotRows = lots.map((r) => {
    const parent = marches.get(ref(r.Marche_parent)!);
    if (!parent) throw new Error(`Lot ${r.id} : marché parent ${r.Marche_parent} introuvable`);
    return marcheRow(r, parent);
  });
  const lotIds = await upsert('Marches (lots)', s.marches, lotRows);
  for (const [k, v] of lotIds) marches.set(k, v);
  counts.Marches = { source: grMarches.length, cible: marches.size };
  delete counts['Marches (lots)'];

  await joins(listJoin(grMarches, 'Specialites_du_marche', marches, specialites, 'Marché.Spécialités'), s.marcheSpecialites, 'marcheId', 'specialiteId');
  await joins(
    grRepondants.flatMap((r) =>
      ids(r.Candidat_aux_marches).flatMap((m) => {
        const b = repondants.get(r.id);
        const t = marches.get(m);
        if (!b || !t) {
          warn(`Candidature : marché ${m} introuvable pour le répondant ${r.id}`);
          return [];
        }
        return [{ b: t, o: b }];
      }),
    ),
    s.candidatures,
    'marcheId',
    'repondantId',
  );

  // --- Déclarations, refus, intérêts, accès, invitations -----------------------------------
  const must = (map: Map<number, number>, v: unknown, what: string, row: number): number | null => {
    const id = mapped(map, v);
    if (!id) warn(`${what} ${row} ignoré : référence ${v} introuvable`);
    return id;
  };
  const declRows: Record<string, unknown>[] = [];
  for (const r of await read('Declarations_Beneficiaires')) {
    const m = must(marches, r.Marche, 'Déclaration', r.id);
    // Déclaration saisie par l'équipe : pas de répondant, c'est normal.
    const rep = ref(r.Repondant) ? must(repondants, r.Repondant, 'Déclaration', r.id) : null;
    if (!m || (ref(r.Repondant) && !rep)) continue;
    declRows.push({ gristId: r.id, repondantId: rep, marcheId: m, estBeneficiaireEclauses: bool(r.Est_beneficiaire_eclauses), beneficiaireId: mapped(beneficiaires, r.Beneficiaire), nom: text(r.Nom), prenom: text(r.Prenom), email: text(r.Email), statut: codeFromLabel(STATUT_DECLARATION_LABELS, r.Statut) ?? 'declare', creeLe: when(r.Cree_le) ?? new Date() });
  }
  const declarations = await upsert('Declarations_Beneficiaires', s.declarationsBeneficiaires, declRows);

  const refusRows: Record<string, unknown>[] = [];
  for (const r of await read('Declarations_Beneficiaires_Refus')) {
    const m = must(marches, r.Marche, 'Refus', r.id);
    if (m) refusRows.push({ gristId: r.id, marcheId: m, refuseLe: when(r.Refuse_le) ?? new Date(), raison: text(r.Raison) });
  }
  await upsert('Declarations_Beneficiaires_Refus', s.declarationsRefus, refusRows);

  const interetRows: { marcheId: number; beneficiaireId: number; creeLe: Date }[] = [];
  for (const r of await read('Marches_Interets')) {
    const m = must(marches, r.Marche, 'Intérêt', r.id);
    const b = must(beneficiaires, r.Beneficiaire, 'Intérêt', r.id);
    if (m && b) interetRows.push({ marcheId: m, beneficiaireId: b, creeLe: when(r.Cree_a) ?? new Date() });
  }
  if (interetRows.length) await db.insert(s.interetsMarches).values(interetRows).onConflictDoNothing();
  counts.Marches_Interets!.cible = interetRows.length;

  const accesRows: Record<string, unknown>[] = [];
  const seenAcces = new Set<string>();
  for (const r of await read('Acces_Coordonnees')) {
    const rep = must(repondants, r.Repondant, 'Accès', r.id);
    const m = must(marches, r.Marche, 'Accès', r.id);
    const b = must(beneficiaires, r.Beneficiaire, 'Accès', r.id);
    if (!rep || !m || !b) continue;
    const k = `${rep}-${m}-${b}`;
    if (seenAcces.has(k)) {
      warn(`Accès ${r.id} ignoré : doublon (répondant, marché, bénéficiaire)`);
      continue;
    }
    seenAcces.add(k);
    accesRows.push({ gristId: r.id, repondantId: rep, marcheId: m, beneficiaireId: b, afficheEmail: bool(r.Affiche_email), afficheTelephone: bool(r.Affiche_telephone), creeLe: when(r.Cree_a) ?? new Date() });
  }
  await upsert('Acces_Coordonnees', s.accesCoordonnees, accesRows);

  const invRows: Record<string, unknown>[] = [];
  for (const r of await read('Invitation_Titulaire')) {
    const m = must(marches, r.Marche, 'Invitation', r.id);
    const e = email(r.Email);
    if (!m || !e) {
      if (m) warn(`Invitation ${r.id} ignorée : e-mail absent`);
      continue;
    }
    const uid = userIds.get(e);
    const [rep] = uid ? await db.select({ id: s.repondants.id }).from(s.repondants).where(sql`${s.repondants.utilisateurId} = ${uid}`) : [];
    invRows.push({ gristId: r.id, marcheId: m, email: e, statut: r.Status === 'pending' ? 'en_attente' : 'traitee', repondantId: rep?.id ?? null, creeLe: when(r.Cree_a) ?? new Date(), traiteLe: when(r.Processed_At), derniereRelanceLe: when(r.Derniere_relance_le) });
  }
  await upsert('Invitation_Titulaire', s.invitationsTitulaires, invRows);

  // --- Contenu du site ----------------------------------------------------------------------
  const faqCats = await upsert('Application_FAQ_Categories', s.faqCategories, (await read('Application_FAQ_Categories')).map((r) => ({ gristId: r.id, titre: text(r.Title) ?? `Catégorie ${r.id}`, slug: text(r.Slug) ?? `categorie-${r.id}`, description: text(r.Description), ordre: num(r.Order) ?? 0, publie: bool(r.Published) })));
  const audience = (v: unknown) => (['public', 'beneficiaire', 'acheteur', 'repondant'].includes(String(v)) ? (v as 'public') : 'public');
  await upsert('Application_FAQ_Questions', s.faqQuestions, (await read('Application_FAQ_Questions')).map((r) => ({ gristId: r.id, categorieId: mapped(faqCats, r.Category), clauseId: mapped(clauses, r.Clause2), question: text(r.Question) ?? '', reponse: text(r.Answer) ?? '', motsCles: text(r.Keywords), audience: audience(r.Audience), auteur: text(r.Auteur), ordre: num(r.Order) ?? 0, publie: bool(r.Published), modifieLe: when(r.Updated_at) ?? new Date() })));
  await upsert('Support_Videos', s.supportVideos, (await read('Support_Videos')).map((r) => ({ gristId: r.id, clauseId: mapped(clauses, r.Clause), libelle: text(r.Label) ?? `Vidéo ${r.id}`, description: text(r.Description), url: text(r.URL) ?? '', audience: audience(r.Audience), auteur: text(r.Auteur), ordre: num(r.Order) ?? 0, publie: bool(r.Published), modifieLe: when(r.Updated_at) ?? new Date() })));

  const INDICATEURS: Record<string, string> = {
    'Autonomie des acheteurs': 'autonomie_acheteurs',
    "Facilité d'utilisation bénéficiaires": 'fiches_a_jour',
    'Bénéficiaires actifs': 'beneficiaires_actifs',
    'Acheteurs actifs': 'acheteurs_actifs',
    'Candidats / titulaires actifs': 'repondants_actifs',
    'Activation des clauses sociales': 'clauses_activees',
    'Bénéficiaires de commande publique': 'beneficiaires_commande_publique',
    'Nombre de profils uniques de bénéficiaires': 'beneficiaires_uniques',
  };
  const TYPES: Record<string, 'utilisable' | 'utilise' | 'utile' | 'impactant'> = { Utilisable: 'utilisable', Utilisé: 'utilise', Utile: 'utile', Impactant: 'impactant' };
  await upsert('Impacts', s.impacts, (await read('Impacts')).map((r) => {
    const label = text(r.Label) ?? `Indicateur ${r.id}`;
    const indicateur = INDICATEURS[label] ?? null;
    if (!indicateur && text(r.Valeur_automatique)) warn(`Impact « ${label} » : calcul automatique sans équivalent, seule la valeur manuelle est reprise`);
    return { gristId: r.id, libelle: label, description: text(r.Description), typeIndicateur: TYPES[String(r.Type_d_indicateur)] ?? 'utile', valeurManuelle: text(r.Valeur_manuelle), indicateur, largeurColonnes: num(r.ColSpan) ?? 1, ordre: num(r.Ordre) ?? 0 };
  }));

  const grLiens = await read('Application_Liens');
  const liensById = new Map(grLiens.map((l) => [l.id, l]));
  const [header] = await read('Application_Header');
  const [footer] = await read('Application_Footer');
  await db.delete(s.liens);
  const zone = async (z: 'entete' | 'pied' | 'pied_bas', list: unknown) => {
    const rows = ids(list).map((id) => liensById.get(id)).filter((l): l is Row => !!l).map((l) => ({
      zone: z,
      libelle: text(l.Label) ?? '',
      url: text(l.Url) ?? (text(l.Nav) && text(l.Nav) !== 'accueil' ? `/${text(l.Nav)}` : '/'),
      variante: text(l.Variant),
      externe: bool(l.External) || !!text(l.Url),
      ordre: num(l.Ordre) ?? 0,
      gristId: l.id,
    }));
    if (rows.length) await db.insert(s.liens).values(rows);
    return rows.length;
  };
  const nLiens = (await zone('entete', header?.Links)) + (await zone('pied', footer?.Links)) + (await zone('pied_bas', footer?.Bottom_Links));
  counts.Application_Liens = { source: grLiens.length, cible: nLiens };
  const [info] = await read('T0_Referentiel_Informations');
  const params: Record<string, string | null> = {
    site_titre: text(header?.Title),
    site_accroche: text(header?.Tagline),
    site_badge_libelle: text(header?.Badge_Label),
    site_badge_variante: text(header?.Badge_Variant),
    site_logo_html: text(header?.Entity_Logo),
    pied_description: text(footer?.Description),
    pied_copyright_html: text(footer?.Copy),
    mentions_rgpd: text(info?.Mentions_RGPD),
  };
  for (const [cle, valeur] of Object.entries(params)) {
    if (valeur) await db.insert(s.parametres).values({ cle, valeur }).onConflictDoUpdate({ target: s.parametres.cle, set: { valeur } });
  }

  // --- Courriers déjà partis ----------------------------------------------------------------
  if (!keepPending) {
    const sent: { evenement: string; cle: string }[] = [];
    for (const r of grMarches) {
      const id = marches.get(r.id);
      if (!id) continue;
      // Tous les marchés parents sont marqués, y compris ceux encore « à notifier » : sinon la première
      // modification notifierait tous les bénéficiaires. `--keep-pending-notifications` laisse ces derniers.
      if (!ref(r.Marche_parent)) sent.push({ evenement: 'marche-publie', cle: String(id) });
      if (r.Statut === 'Déclaration à valider') sent.push({ evenement: 'marche-a-valider', cle: String(id) });
      if (r.Statut === 'Clause validée') sent.push({ evenement: 'marche-validee', cle: String(id) });
    }
    if (sent.length) await db.insert(s.notificationsEnvoyees).values(sent).onConflictDoNothing();
    counts['courriers marqués envoyés'] = { source: sent.length, cible: sent.length };
  }

  for (const e of authUsers.keys()) if (!usedAuth.has(e)) warn(`Compte de connexion sans profil, non importé : ${e.replace(/^(.{2}).*(@.*)$/, '$1***$2')}`);

  counts.Application_AuthUser!.cible = usedAuth.size;
  counts.Application_Header!.cible = header ? 1 : 0;
  counts.Application_Footer!.cible = footer ? 1 : 0;
  counts.T0_Referentiel_Informations!.cible = params.mentions_rgpd ? 1 : 0;

  // --- Rapport ------------------------------------------------------------------------------
  console.log('Table'.padEnd(40), 'Grist'.padStart(6), 'PostgreSQL'.padStart(11));
  for (const [t, c] of Object.entries(counts)) console.log(t.padEnd(40), String(c.source).padStart(6), String(c.cible).padStart(11), c.source !== c.cible ? '  ← écart' : '');
  console.log(`\n${warnings.length + groups.size} avertissement(s)`);
  for (const [title, list] of groups) console.log(` - ${list.length} × ${title}\n     ex. ${list.slice(0, 5).join(', ')}${list.length > 5 ? '…' : ''}`);
  for (const w of warnings) console.log(` - ${w}`);
}

main()
  .catch((e) => {
    console.error('Échec de l’import :', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pg.end();
    // Les connexions HTTP persistantes vers Grist peuvent retenir le processus : tout est terminé, on sort.
    process.exit(process.exitCode ?? 0);
  });
