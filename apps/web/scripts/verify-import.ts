/**
 * Compare, sur les données importées, les champs que Grist calculait par formule avec ceux que la
 * couche de compatibilité calcule maintenant. LECTURE SEULE des deux côtés. Chaque écart est détaillé :
 * c'est le contrôle de parité des formules réimplémentées.
 *
 *   npx tsx scripts/verify-import.ts
 */
import { sql } from 'drizzle-orm';
import { database } from '../src/server/db/client';
import * as s from '../src/server/db/schema';
import { GristClient, type Row } from '../src/server/grist/client';
import * as specs from '../src/server/compat/specs';
import * as others from '../src/server/compat/others';
import { marches as marchesCompat } from '../src/server/compat/marches';

process.loadEnvFile('.env.local');
const g = new GristClient({ baseUrl: process.env.GRIST_BASE_URL!, docId: process.env.GRIST_DOC_ID!, apiKey: process.env.GRIST_API_KEY! });
const db = database();

const maps = async (table: Parameters<typeof db.select>[0] extends never ? never : any) => {
  const rows = (await db.select({ id: table.id, g: table.gristId }).from(table)) as { id: number; g: number | null }[];
  return new Map(rows.filter((r) => r.g != null).map((r) => [r.g!, r.id]));
};
const M = {
  marches: await maps(s.marches),
  repondants: await maps(s.repondants),
  beneficiaires: await maps(s.beneficiaires),
  clauses: await maps(s.clausesSociales),
  declarations: await maps(s.declarationsBeneficiaires),
  acheteurs: await maps(s.acheteurs),
  utilisateursAcheteurs: await maps(s.utilisateursAcheteurs),
};

let total = 0;
let diffs = 0;
const shown: Record<string, number> = {};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const ids = (v: unknown): number[] => (Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number') : []);
const toNew = (m: Map<number, number>, v: unknown) => ids(v).map((x) => m.get(x) ?? -x).sort((a, b) => a - b);
const one = (m: Map<number, number>, v: unknown) => (typeof v === 'number' && v > 0 ? (m.get(v) ?? -v) : 0);
const bool = (v: unknown) => v === true || v === 1;

function check(table: string, field: string, grid: number, expected: unknown, actual: unknown) {
  total++;
  if (same(expected, actual)) return;
  diffs++;
  const k = `${table}.${field}`;
  shown[k] = (shown[k] ?? 0) + 1;
  if (shown[k]! <= 3) console.log(`ÉCART ${k} (ligne Grist ${grid}) : Grist ${JSON.stringify(expected)} ≠ PostgreSQL ${JSON.stringify(actual)}`);
}

// --- Marchés -----------------------------------------------------------------------------------
const gm = await g.records('Marches');
const cm = new Map((await marchesCompat.read()).map((r) => [r.id, r]));
for (const r of gm) {
  const c = cm.get(M.marches.get(r.id) ?? 0);
  if (!c) {
    check('Marches', 'présence', r.id, true, false);
    continue;
  }
  const t = (f: string, exp: unknown, act: unknown) => check('Marches', f, r.id, exp, act);
  t('Statut', r.Statut, c.Statut);
  t('Intitule_propre', r.Intitule_propre, c.Intitule_propre);
  t('Intitule_Lot', r.Intitule_Lot, c.Intitule_Lot);
  t('Lot_Label', r.Lot_Label ?? '', c.Lot_Label);
  t('Marche_parent_Intitule_propre', r.Marche_parent_Intitule_propre, c.Marche_parent_Intitule_propre);
  t('Est_lot', bool(r.Est_lot), c.Est_lot);
  t('Est_marche_parent', bool(r.Est_marche_parent), c.Est_marche_parent);
  t('Marche_racine', one(M.marches, r.Marche_racine), c.Marche_racine);
  t('Lots', toNew(M.marches, r.Lots), [...(c.Lots as number[])].sort((a, b) => a - b));
  t('Nb_lots', r.Nb_lots, c.Nb_lots);
  t('Lots_eclauses', toNew(M.marches, r.Lots_eclauses), [...(c.Lots_eclauses as number[])].sort((a, b) => a - b));
  t('Nb_lots_en_attente_declaration', r.Nb_lots_en_attente_declaration, c.Nb_lots_en_attente_declaration);
  t('Nb_lots_a_valider', r.Nb_lots_a_valider, c.Nb_lots_a_valider);
  t('Nb_lots_valides', r.Nb_lots_valides, c.Nb_lots_valides);
  t('Statut_global', r.Statut_global, c.Statut_global);
  t('Titulaires_lots', toNew(M.repondants, r.Titulaires_lots), [...(c.Titulaires_lots as number[])].sort((a, b) => a - b));
  t('Candidats', toNew(M.repondants, r.Candidats), [...(c.Candidats as number[])].sort((a, b) => a - b));
  t('Beneficiaires (déclarations)', toNew(M.declarations, r.Beneficiaires), [...(c.Beneficiaires as number[])].sort((a, b) => a - b));
  t('Beneficiaires_tous_lots', toNew(M.declarations, r.Beneficiaires_tous_lots), [...(c.Beneficiaires_tous_lots as number[])].sort((a, b) => a - b));
  t('Clauses_sociales_parent_ou_enfants', one(M.clauses, r.Clauses_sociales_parent_ou_enfants), c.Clauses_sociales_parent_ou_enfants);
  t('Clauses_sociales_lots', toNew(M.clauses, r.Clauses_sociales_lots), [...(c.Clauses_sociales_lots as number[])].sort((a, b) => a - b));
  // L'API REST de Grist n'encode pas les dictionnaires : on compare seulement le nombre de lots décrits.
  t('Lots_Detail (nombre)', Array.isArray(r.Lots_Detail) ? r.Lots_Detail.length - 1 : 0, (c.Lots_Detail as unknown[]).length);
  t('A_valider', bool(r.A_valider), c.A_valider);
  t('Clause_validee', bool(r.Clause_validee), c.Clause_validee);
  t('Doit_archiver', bool(r.Doit_archiver), c.Doit_archiver);
  t('Acheteur_Nom', r.Acheteur_Nom, c.Acheteur_Nom);
  t('Titulaire_Label', r.Titulaire_Label ?? '', c.Titulaire_Label);
  t('Acheteur_Utilisateurs_Acheteurs', toNew(M.utilisateursAcheteurs, r.Acheteur_Utilisateurs_Acheteurs), [...(c.Acheteur_Utilisateurs_Acheteurs as number[])].sort((a, b) => a - b));
  t('Date_Limite_de_Remise_des_Offres', typeof r.Date_Limite_de_Remise_des_Offres === 'number' ? r.Date_Limite_de_Remise_des_Offres : null, c.Date_Limite_de_Remise_des_Offres);
}

// --- Bénéficiaires, répondants, clauses --------------------------------------------------------
const cb = new Map((await specs.beneficiaires.read()).map((r) => [r.id, r]));
for (const r of await g.records('Beneficiaires')) {
  const c = cb.get(M.beneficiaires.get(r.id) ?? 0);
  if (!c) {
    check('Beneficiaires', 'présence', r.id, true, false);
    continue;
  }
  const hasMail = typeof r.Courriel === 'string' && r.Courriel.includes('@');
  check('Beneficiaires', 'Eligible', r.id, bool(r.Eligible), c.Eligible);
  check('Beneficiaires', 'Doit_supprimer', r.id, bool(r.Doit_supprimer), c.Doit_supprimer);
  if (hasMail) check('Beneficiaires', 'Courriel', r.id, String(r.Courriel).trim().toLowerCase(), c.Courriel);
  check('Beneficiaires', 'Compte_active', r.id, bool(r.Compte_active), c.Compte_active);
  check('Beneficiaires', 'Annee_de_diplome', r.id, String(r.Annee_de_diplome ?? ''), c.Annee_de_diplome);
}
const cr = new Map((await specs.repondants.read()).map((r) => [r.id, r]));
for (const r of await g.records('Repondants')) {
  const c = cr.get(M.repondants.get(r.id) ?? 0);
  if (!c) {
    check('Repondants', 'présence', r.id, true, false);
    continue;
  }
  check('Repondants', 'Doit_supprimer', r.id, false, false);
  check('Repondants', 'Label', r.id, r.Label ?? '', c.Label);
  check('Repondants', 'Titulaire_aux_marches', r.id, toNew(M.marches, r.Titulaire_aux_marches), [...(c.Titulaire_aux_marches as number[])].sort((a, b) => a - b));
}
const cc = new Map((await specs.clauses.read()).map((r) => [r.id, r]));
for (const r of await g.records('Clauses_sociales')) {
  const c = cc.get(M.clauses.get(r.id) ?? 0)!;
  // Grist liste aussi les adresses vides (bénéficiaires sans e-mail) : on les écarte, comme les envois.
  const mails = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x !== 'L' && x !== '').map((x) => x.toLowerCase()).sort() : []);
  check('Clauses_sociales', 'Beneficiaires_Actif', r.id, mails(r.Beneficiaires_Actif), mails(c.Beneficiaires_Actif));
  check('Clauses_sociales', 'Beneficiaires', r.id, toNew(M.beneficiaires, r.Beneficiaires), [...(c.Beneficiaires as number[])].sort((a, b) => a - b));
  check('Clauses_sociales', 'Marches', r.id, toNew(M.marches, r.Marches), [...(c.Marches as number[])].sort((a, b) => a - b));
}

// --- Déclarations, accès, impacts --------------------------------------------------------------
const cd = new Map((await others.declarations.read()).map((r) => [r.id, r]));
for (const r of await g.records('Declarations_Beneficiaires')) {
  const c = cd.get(M.declarations.get(r.id) ?? 0);
  if (!c) {
    check('Declarations', 'présence', r.id, true, false);
    continue;
  }
  check('Declarations', 'Statut', r.id, r.Statut, c.Statut);
  check('Declarations', 'Email_envoi', r.id, (r.Email_envoi ?? '') || '', c.Email_envoi);
  check('Declarations', 'Marche_Intitule_propre', r.id, r.Marche_Intitule_propre, c.Marche_Intitule_propre);
  check('Declarations', 'Marche_Lot_Label', r.id, r.Marche_Lot_Label ?? '', c.Marche_Lot_Label);
}
const ci = new Map((await others.impacts.read()).map((r) => [String(r.Label), r]));
for (const r of await g.records('Impacts')) {
  const c = ci.get(String(r.Label));
  // Les valeurs automatiques bougent avec les connexions : on compare le texte quand il est fixe, le type sinon.
  // Python écrit « 83.0 % » là où on écrit « 83 % » : même valeur, présentation sans décimale inutile.
  check('Impacts', 'Valeur', r.id, String(r.Valeur ?? '').replace(/\.0%/, '%'), String(c?.Valeur ?? '').replace(/\.0%/, '%'));
}

console.log(`\n${total} comparaisons, ${diffs} écart(s).`);
await db.execute(sql`select 1`);
process.exit(diffs ? 1 : 0);
