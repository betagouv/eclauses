import { eq, inArray } from 'drizzle-orm';
import { database } from '../db/client';
import { STATUT_DECLARATION_LABELS } from '../db/labels';
import * as s from '../db/schema';
import { valeurIndicateur } from '../services/indicateurs';
import { LegacyTable, type Row } from './engine';
import { marches } from './marches';

const AUDIENCES = { public: 'public', beneficiaire: 'beneficiaire', acheteur: 'acheteur', repondant: 'repondant' };
const STATUT_INVITATION = { en_attente: 'pending', traitee: 'processed' };
const TYPE_INDICATEUR = { utilisable: 'Utilisable', utilise: 'Utilisé', utile: 'Utile', impactant: 'Impactant' };

/** Marchés (au format des pages) par identifiant : pour les champs `Marche_*` copiés des anciennes formules. */
async function marcheRows(ids: number[]): Promise<Map<number, Row>> {
  const unique = [...new Set(ids.filter(Boolean))];
  return new Map((await marches.read({ ids: unique })).map((m) => [m.id, m]));
}

async function emailsByBeneficiaire(ids: number[]): Promise<Map<number, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const rows = await database()
    .select({ id: s.beneficiaires.id, email: s.utilisateurs.email })
    .from(s.beneficiaires)
    .leftJoin(s.utilisateurs, eq(s.utilisateurs.id, s.beneficiaires.utilisateurId))
    .where(inArray(s.beneficiaires.id, unique));
  return new Map(rows.filter((r) => r.email).map((r) => [r.id, r.email!]));
}

const marcheCopy = (m: Row | undefined) => ({
  Marche_Intitule_propre: m?.Intitule_propre ?? '',
  Marche_Marche_parent_Intitule_propre: m?.Marche_parent_Intitule_propre ?? '',
  Marche_Numero_de_lot: m?.Numero_de_lot ?? '',
  Marche_Intitule_du_lot: m?.Intitule_du_lot ?? '',
  Marche_Lot_Label: m?.Lot_Label ?? '',
  Marche_Acheteur: m?.Acheteur ?? 0,
  Marche_Acheteur_Nom: m?.Acheteur_Nom ?? '',
  Marche_Titulaire_Label: m?.Titulaire_Label ?? '',
});

export const declarations = new LegacyTable({
  table: s.declarationsBeneficiaires,
  fields: {
    Repondant: { prop: 'repondantId', kind: 'ref', readonly: true },
    Marche: { prop: 'marcheId', kind: 'ref' },
    Est_beneficiaire_eclauses: { prop: 'estBeneficiaireEclauses', kind: 'bool' },
    Beneficiaire: { prop: 'beneficiaireId', kind: 'ref' },
    Nom: { prop: 'nom', kind: 'text' },
    Prenom: { prop: 'prenom', kind: 'text' },
    Email: { prop: 'email', kind: 'text' },
    Statut: { prop: 'statut', kind: 'enum', labels: STATUT_DECLARATION_LABELS },
    Cree_le: { prop: 'creeLe', kind: 'ts', readonly: true },
  },
  computed: async (rows) => {
    const [ms, mails] = await Promise.all([marcheRows(rows.map((r) => r.Marche as number)), emailsByBeneficiaire(rows.map((r) => r.Beneficiaire as number))]);
    for (const row of rows) {
      const courriel = mails.get(row.Beneficiaire as number) ?? '';
      Object.assign(row, { Beneficiaire__Courriel: courriel, Email_envoi: row.Email || courriel }, marcheCopy(ms.get(row.Marche as number)));
    }
  },
});

export const refus = new LegacyTable({
  table: s.declarationsRefus,
  fields: {
    Marche: { prop: 'marcheId', kind: 'ref' },
    Refuse_le: { prop: 'refuseLe', kind: 'ts', readonly: true },
    Raison: { prop: 'raison', kind: 'text' },
  },
  computed: async (rows) => {
    const ms = await marcheRows(rows.map((r) => r.Marche as number));
    const titulaires = [...ms.values()].map((m) => m.Titulaire as number).filter(Boolean);
    const reps = titulaires.length ? await (await import('./specs')).repondants.read({ ids: titulaires }) : [];
    const repById = new Map(reps.map((r) => [r.id, r]));
    for (const row of rows) {
      const m = ms.get(row.Marche as number);
      const titulaire = (m?.Titulaire as number) ?? 0;
      Object.assign(row, marcheCopy(m), { Marche_Titulaire: titulaire, Marche_Titulaire_Email: repById.get(titulaire)?.Email ?? '' });
    }
  },
});

export const interets = new LegacyTable({
  table: s.interetsMarches,
  fields: {
    Marche: { prop: 'marcheId', kind: 'ref' },
    Beneficiaire: { prop: 'beneficiaireId', kind: 'ref', readonly: true },
    Cree_a: { prop: 'creeLe', kind: 'ts', readonly: true },
  },
  computed: async (rows) => {
    const ms = await marcheRows(rows.map((r) => r.Marche as number));
    for (const row of rows) {
      const m = ms.get(row.Marche as number);
      Object.assign(row, { Marche_Candidats: m?.Candidats ?? [], Marche_Titulaire: m?.Titulaire ?? 0 });
    }
  },
});

export const accesCoordonnees = new LegacyTable({
  table: s.accesCoordonnees,
  fields: {
    Repondant: { prop: 'repondantId', kind: 'ref', readonly: true },
    Marche: { prop: 'marcheId', kind: 'ref' },
    Beneficiaire: { prop: 'beneficiaireId', kind: 'ref' },
    Affiche_email: { prop: 'afficheEmail', kind: 'bool' },
    Affiche_telephone: { prop: 'afficheTelephone', kind: 'bool' },
    Cree_a: { prop: 'creeLe', kind: 'ts', readonly: true },
  },
  computed: async (rows) => {
    const [ms, mails] = await Promise.all([marcheRows(rows.map((r) => r.Marche as number)), emailsByBeneficiaire(rows.map((r) => r.Beneficiaire as number))]);
    for (const row of rows) {
      Object.assign(row, { Beneficiaire__Courriel: mails.get(row.Beneficiaire as number) ?? '', Marche_Intitule_propre: ms.get(row.Marche as number)?.Intitule_propre ?? '' });
    }
  },
});

export const invitations = new LegacyTable({
  table: s.invitationsTitulaires,
  fields: {
    Marche: { prop: 'marcheId', kind: 'ref' },
    Email: { prop: 'email', kind: 'text' },
    Status: { prop: 'statut', kind: 'enum', labels: STATUT_INVITATION, readonly: true },
    Cree_a: { prop: 'creeLe', kind: 'ts', readonly: true },
    Processed_At: { prop: 'traiteLe', kind: 'ts', readonly: true },
    Derniere_relance_le: { prop: 'derniereRelanceLe', kind: 'ts' },
  },
  computed: async (rows) => {
    const ms = await marcheRows(rows.map((r) => r.Marche as number));
    const mails = rows.map((r) => String(r.Email ?? '').toLowerCase()).filter(Boolean);
    const users = mails.length
      ? await database().select({ id: s.utilisateurs.id, email: s.utilisateurs.email, hash: s.utilisateurs.motDePasseHash }).from(s.utilisateurs)
      : [];
    const byMail = new Map(users.map((u) => [u.email.toLowerCase(), u]));
    for (const row of rows) {
      const m = ms.get(row.Marche as number);
      const u = byMail.get(String(row.Email ?? '').toLowerCase());
      Object.assign(row, marcheCopy(m), { AuthUser: u?.hash ? u.id : 0, Application_Password_Reset: 0, Application_Password_Reset_Lien: '', Token: '' });
    }
  },
});

/* ------------------------------------------------------------------ Contenu --------------- */

export const faqCategories = new LegacyTable({
  table: s.faqCategories,
  fields: {
    Title: { prop: 'titre', kind: 'text', readonly: true },
    Slug: { prop: 'slug', kind: 'text', readonly: true },
    Order: { prop: 'ordre', kind: 'num', readonly: true },
    Published: { prop: 'publie', kind: 'bool', readonly: true },
    Description: { prop: 'description', kind: 'text', readonly: true },
  },
});

export const faqQuestions = new LegacyTable({
  table: s.faqQuestions,
  fields: {
    Question: { prop: 'question', kind: 'text', readonly: true },
    Answer: { prop: 'reponse', kind: 'text', readonly: true },
    Category: { prop: 'categorieId', kind: 'ref', readonly: true },
    Keywords: { prop: 'motsCles', kind: 'text', readonly: true },
    Order: { prop: 'ordre', kind: 'num', readonly: true },
    Published: { prop: 'publie', kind: 'bool', readonly: true },
    Updated_at: { prop: 'modifieLe', kind: 'ts', readonly: true },
    Audience: { prop: 'audience', kind: 'enum', labels: AUDIENCES, readonly: true },
    Auteur: { prop: 'auteur', kind: 'text', readonly: true },
    Clause2: { prop: 'clauseId', kind: 'ref', readonly: true },
  },
});

export const supportVideos = new LegacyTable({
  table: s.supportVideos,
  fields: {
    Label: { prop: 'libelle', kind: 'text', readonly: true },
    Description: { prop: 'description', kind: 'text', readonly: true },
    Order: { prop: 'ordre', kind: 'num', readonly: true },
    Published: { prop: 'publie', kind: 'bool', readonly: true },
    Audience: { prop: 'audience', kind: 'enum', labels: AUDIENCES, readonly: true },
    Updated_at: { prop: 'modifieLe', kind: 'ts', readonly: true },
    Auteur: { prop: 'auteur', kind: 'text', readonly: true },
    Clause: { prop: 'clauseId', kind: 'ref', readonly: true },
    URL: { prop: 'url', kind: 'text', readonly: true },
  },
});

export const impacts = new LegacyTable({
  table: s.impacts,
  fields: {
    Label: { prop: 'libelle', kind: 'text', readonly: true },
    Description: { prop: 'description', kind: 'text', readonly: true },
    Type_d_indicateur: { prop: 'typeIndicateur', kind: 'enum', labels: TYPE_INDICATEUR, readonly: true },
    Valeur_manuelle: { prop: 'valeurManuelle', kind: 'text', readonly: true },
    ColSpan: { prop: 'largeurColonnes', kind: 'num', readonly: true },
    Ordre: { prop: 'ordre', kind: 'num', readonly: true },
  },
  computed: async (rows) => {
    const full = await database().select({ id: s.impacts.id, indicateur: s.impacts.indicateur }).from(s.impacts);
    const code = new Map(full.map((f) => [f.id, f.indicateur]));
    for (const row of rows) row.Valeur = row.Valeur_manuelle || (await valeurIndicateur(code.get(row.id) ?? null));
  },
});
