import { eq, inArray } from 'drizzle-orm';
import { database } from '../db/client';
import { CATEGORIE_ACHETEUR_LABELS, STATUT_DECLARATION_LABELS, STATUT_MARCHE_LABELS } from '../db/labels';
import { beneficiaireADetruire, beneficiaireEligible } from '../db/expr';
import * as s from '../db/schema';
import { LegacyTable, type Row, type TableSpec } from './engine';

const NONE: Record<string, string> = {};

/** Adresses e-mail des comptes, par identifiant de compte. */
async function emailsOf(userIds: (number | null)[]): Promise<Map<number, string>> {
  const ids = [...new Set(userIds.filter((x): x is number => !!x))];
  if (!ids.length) return new Map();
  const rows = await database().select({ id: s.utilisateurs.id, email: s.utilisateurs.email }).from(s.utilisateurs).where(inArray(s.utilisateurs.id, ids));
  return new Map(rows.map((r) => [r.id, r.email]));
}

/* ------------------------------------------------------------------ Référentiels --------- */

const referentiel = (spec: TableSpec) => new LegacyTable(spec);

export const formations = referentiel({
  table: s.formations,
  fields: { Intitule: { prop: 'intitule', kind: 'text', readonly: true } },
});

export const regions = referentiel({
  table: s.regions,
  fields: {
    Intitule: { prop: 'intitule', kind: 'text', readonly: true },
    Chef_lieux: { prop: 'chefLieu', kind: 'text', readonly: true },
    Latitude: { prop: 'latitude', kind: 'num', readonly: true },
    Longitude: { prop: 'longitude', kind: 'num', readonly: true },
    Adresse_geocodee: { prop: 'adresseGeocodee', kind: 'text', readonly: true },
  },
});

export const departements = referentiel({
  table: s.departements,
  fields: {
    Departement_Numero: { prop: 'numero', kind: 'text', readonly: true },
    Departement_Nom: { prop: 'nom', kind: 'text', readonly: true },
    Affichage: { prop: 'libelleAffichage', kind: 'text', readonly: true },
    Chef_lieu: { prop: 'chefLieu', kind: 'text', readonly: true },
    Villes_Principales: { prop: 'villesPrincipales', kind: 'text', readonly: true },
    Latitude: { prop: 'latitude', kind: 'num', readonly: true },
    Longitude: { prop: 'longitude', kind: 'num', readonly: true },
    Adresse_geocodee: { prop: 'adresseGeocodee', kind: 'text', readonly: true },
  },
  computed: async (rows) => {
    const regs = await database().select().from(s.departements);
    const names = new Map((await database().select().from(s.regions)).map((r) => [r.id, r.intitule]));
    const byId = new Map(regs.map((d) => [d.id, d]));
    for (const row of rows) row.Region = names.get(byId.get(row.id)?.regionId ?? 0) ?? '';
  },
});

export const specialites = referentiel({
  table: s.specialites,
  fields: {
    Intitule: { prop: 'intitule', kind: 'text', readonly: true },
    Clause_sociale: { prop: 'clauseId', kind: 'ref', readonly: true },
    Tooltip: { prop: 'infobulle', kind: 'text', readonly: true },
  },
});

/** Mentions RGPD : un paramètre du site, présenté comme l'ancienne table à une ligne. */
export const informations = {
  async read(): Promise<Row[]> {
    const [p] = await database().select().from(s.parametres).where(eq(s.parametres.cle, 'mentions_rgpd'));
    return [{ id: 1, Mentions_RGPD: p?.valeur ?? '' }];
  },
};

/* ------------------------------------------------------------------ Clauses -------------- */

export const clauses = new LegacyTable({
  table: s.clausesSociales,
  fields: {
    Nom_de_la_clause: { prop: 'nom', kind: 'text', readonly: true },
    Gabarit_d_article_de_marche: { prop: 'gabaritArticle', kind: 'text', readonly: true },
    html_gabarit_annuaire_clause: { prop: 'gabaritAnnuaireHtml', kind: 'text', readonly: true },
  },
  computed: async (rows) => {
    const db = database();
    const ids = rows.map((r) => r.id);
    const [marchesRows, links] = await Promise.all([
      db.select({ id: s.marches.id, clauseId: s.marches.clauseId }).from(s.marches).where(inArray(s.marches.clauseId, ids)),
      // Rattachés à la clause (tous) ; les « actifs » ont en plus une fiche à jour.
      db
        .select({ clauseId: s.beneficiaireClauses.clauseId, id: s.beneficiaires.id, email: s.utilisateurs.email })
        .from(s.beneficiaireClauses)
        .innerJoin(s.beneficiaires, eq(s.beneficiaires.id, s.beneficiaireClauses.beneficiaireId))
        .leftJoin(s.utilisateurs, eq(s.utilisateurs.id, s.beneficiaires.utilisateurId))
        .where(inArray(s.beneficiaireClauses.clauseId, ids)),
    ]);
    const actives = await db.select({ id: s.beneficiaires.id }).from(s.beneficiaires).where(eq(s.beneficiaires.ficheAJour, true));
    const actifIds = new Set(actives.map((a) => a.id));
    for (const row of rows) {
      row.Marches = marchesRows.filter((m) => m.clauseId === row.id).map((m) => m.id);
      // Comme en production : `Beneficiaires` = tous les rattachés, `Beneficiaires_Actif` = e-mails des fiches à jour.
      const attached = links.filter((l) => l.clauseId === row.id);
      row.Beneficiaires = attached.map((l) => l.id);
      row.Beneficiaires_Actif = attached.filter((l) => actifIds.has(l.id)).map((l) => l.email).filter((e): e is string => !!e);
      row.Documents = [];
    }
  },
});

/* ------------------------------------------------------------------ Acheteurs ------------ */

export const acheteurs = new LegacyTable({
  table: s.acheteurs,
  fields: {
    Nom: { prop: 'nom', kind: 'text' },
    Ministere: { prop: 'ministere', kind: 'text', readonly: true },
    Categorie: { prop: 'categorie', kind: 'enum', labels: CATEGORIE_ACHETEUR_LABELS, readonly: true },
  },
  computed: async (rows) => {
    const links = await database().select({ id: s.marches.id, acheteurId: s.marches.acheteurId }).from(s.marches).where(inArray(s.marches.acheteurId, rows.map((r) => r.id)));
    const users = await database().select({ id: s.utilisateursAcheteurs.id, acheteurId: s.utilisateursAcheteurs.acheteurId }).from(s.utilisateursAcheteurs);
    for (const row of rows) {
      row.Marches = links.filter((m) => m.acheteurId === row.id).map((m) => m.id);
      row.Utilisateurs_Acheteurs = users.filter((u) => u.acheteurId === row.id).map((u) => u.id);
    }
  },
});

export const utilisateursAcheteurs = new LegacyTable({
  table: s.utilisateursAcheteurs,
  fields: {
    Nom: { prop: 'nom', kind: 'text' },
    Prenom: { prop: 'prenom', kind: 'text' },
    Entite_de_rattachement: { prop: 'acheteurId', kind: 'ref', readonly: true },
  },
  computed: async (rows) => {
    const full = await database().select().from(s.utilisateursAcheteurs).where(inArray(s.utilisateursAcheteurs.id, rows.map((r) => r.id)));
    const mails = await emailsOf(full.map((u) => u.utilisateurId));
    const byId = new Map(full.map((u) => [u.id, u]));
    for (const row of rows) {
      row.Email = mails.get(byId.get(row.id)?.utilisateurId ?? 0) ?? '';
      row.Account = byId.get(row.id)?.utilisateurId ?? 0;
    }
  },
});

/* ------------------------------------------------------------------ Répondants ----------- */

export const repondants = new LegacyTable({
  table: s.repondants,
  fields: {
    Nom: { prop: 'nom', kind: 'text' },
    Prenom: { prop: 'prenom', kind: 'text' },
    Telephone: { prop: 'telephone', kind: 'text' },
    Raison_sociale: { prop: 'raisonSociale', kind: 'text' },
    Siret: { prop: 'siret', kind: 'text' },
    Date_de_suppression: { prop: 'anonymiseLe', kind: 'date', readonly: true },
  },
  lists: {
    Candidat_aux_marches: { table: s.candidatures, owner: 'repondantId', other: 'marcheId' },
  },
  computed: async (rows) => {
    const db = database();
    const full = await db.select().from(s.repondants).where(inArray(s.repondants.id, rows.map((r) => r.id)));
    const mails = await emailsOf(full.map((r) => r.utilisateurId));
    const titulaires = await db.select({ id: s.marches.id, titulaireId: s.marches.titulaireId }).from(s.marches);
    const byId = new Map(full.map((r) => [r.id, r]));
    for (const row of rows) {
      const r = byId.get(row.id)!;
      const email = mails.get(r.utilisateurId ?? 0) ?? '';
      row.Email = email;
      row.Account = r.utilisateurId ?? 0;
      row.Titulaire_aux_marches = titulaires.filter((m) => m.titulaireId === row.id).map((m) => m.id);
      // Même libellé que la formule `Label` de la production : raison sociale, sinon adresse e-mail.
      row.Label = r.raisonSociale || email;
    }
  },
});

/* ------------------------------------------------------------------ Bénéficiaires -------- */

export const CONSENT_ANNUAIRE = 'Je_consens_a_figurer_dans_l_annuaire_partage_avec_les_professionnels_du_secteur';
export const CONSENT_CONTACT = 'Je_consens_a_etre_contacte_pour_rejoindre_des_groupements';

export const beneficiaires = new LegacyTable({
  table: s.beneficiaires,
  fields: {
    NOM: { prop: 'nom', kind: 'text' },
    Prenom: { prop: 'prenom', kind: 'text' },
    Telephone: { prop: 'telephone', kind: 'text' },
    Formation: { prop: 'formationId', kind: 'ref' },
    Autre_Formation: { prop: 'autreFormation', kind: 'text' },
    Annee_de_diplome: { prop: 'anneeDiplome', kind: 'year' },
    Specialite_ecole: { prop: 'specialiteEcole', kind: 'text' },
    Sous_specialite: { prop: 'sousSpecialite', kind: 'text' },
    Intitule_du_memoire: { prop: 'intituleMemoire', kind: 'text' },
    Autres_informations: { prop: 'autresInformations', kind: 'text' },
    Missions_proposees: { prop: 'missionsProposees', kind: 'text', readonly: true },
    Commentaire: { prop: 'commentaire', kind: 'text', readonly: true },
    [CONSENT_ANNUAIRE]: { prop: 'consentementAnnuaire', kind: 'bool' },
    [CONSENT_CONTACT]: { prop: 'consentementContactGroupements', kind: 'bool' },
    alumni: { prop: 'alumni', kind: 'bool', readonly: true },
    Fiche_MAJ: { prop: 'ficheAJour', kind: 'bool' },
    Date_de_suppression: { prop: 'anonymiseLe', kind: 'date', readonly: true },
  },
  lists: {
    Specialite: { table: s.beneficiaireSpecialites, owner: 'beneficiaireId', other: 'specialiteId' },
    Departement_de_residence: { table: s.beneficiaireDepartements, owner: 'beneficiaireId', other: 'departementId' },
    Regions_ou_vous_etes_mobile: { table: s.beneficiaireRegions, owner: 'beneficiaireId', other: 'regionId' },
    Clauses_sociales_de_rattachement: { table: s.beneficiaireClauses, owner: 'beneficiaireId', other: 'clauseId' },
  },
  computed: async (rows) => {
    const db = database();
    const full = await db
      .select({
        id: s.beneficiaires.id,
        utilisateurId: s.beneficiaires.utilisateurId,
        cv: s.beneficiaires.cvFichierId,
        diplomation: s.beneficiaires.dateDiplomation,
        eligible: beneficiaireEligible,
        aDetruire: beneficiaireADetruire,
      })
      .from(s.beneficiaires)
      .where(inArray(s.beneficiaires.id, rows.map((r) => r.id)));
    const users = await db.select().from(s.utilisateurs).where(inArray(s.utilisateurs.id, full.map((f) => f.utilisateurId).filter((x): x is number => !!x)));
    const userById = new Map(users.map((u) => [u.id, u]));
    const byId = new Map(full.map((f) => [f.id, f]));
    // Libellés des références (anciennes colonnes d'affichage `gristHelper_Display*` de Grist).
    const [forms, specs, deps, regs] = await Promise.all([
      db.select().from(s.formations),
      db.select().from(s.specialites),
      db.select().from(s.departements),
      db.select().from(s.regions),
    ]);
    const names = <T extends { id: number }>(list: T[], label: (x: T) => string) => new Map(list.map((x) => [x.id, label(x)]));
    const formName = names(forms, (x) => x.intitule);
    const specName = names(specs, (x) => x.intitule);
    const depName = names(deps, (x) => x.libelleAffichage || x.nom);
    const regName = names(regs, (x) => x.intitule);
    const labels = (ids: unknown, map: Map<number, string>) => (Array.isArray(ids) ? ids : []).map((i) => map.get(i as number)).filter((x): x is string => !!x);
    for (const row of rows) {
      const f = byId.get(row.id)!;
      const u = userById.get(f.utilisateurId ?? 0);
      row.Formation_Libelle = formName.get(row.Formation as number) ?? '';
      row.Specialite_Libelles = labels(row.Specialite, specName);
      row.Departement_Libelles = labels(row.Departement_de_residence, depName);
      row.Region_Libelles = labels(row.Regions_ou_vous_etes_mobile, regName);
      row.Courriel = u?.email ?? '';
      row.Account = u?.motDePasseHash ? u.id : 0;
      row.Compte_active = !!u?.motDePasseHash;
      row.Eligible = f.eligible;
      row.Doit_supprimer = f.aDetruire;
      row.curriculum_vitae = f.cv ? [f.cv] : [];
    }
  },
});

/* ------------------------------------------------------------------ Mots de passe -------- */
export { NONE, STATUT_DECLARATION_LABELS, STATUT_MARCHE_LABELS };
