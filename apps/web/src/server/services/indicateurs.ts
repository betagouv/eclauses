import { and, count, eq, gt, sql } from 'drizzle-orm';
import { database } from '../db/client';
import { beneficiaireEligible } from '../db/expr';
import * as s from '../db/schema';

/**
 * Indicateurs d'impact calculables, remplaçant les extraits de code Python que Grist exécutait dans
 * la colonne `Valeur_automatique`. Une ligne d'`impacts` désigne l'indicateur par son code.
 */
const SIX_MOIS = sql`now() - interval '6 months'`;
const pct = (n: number, d: number, digits = 0) => (d ? `${((n / d) * 100).toFixed(digits)}` : '0');

export const INDICATEURS: Record<string, () => Promise<string>> = {
  async autonomie_acheteurs() {
    const db = database();
    const [{ n: autonomes }] = await db.select({ n: sql<number>`count(distinct ${s.marches.acheteurId})::int` }).from(s.marches).where(eq(s.marches.creationEnAutonomie, true));
    const [{ n: avecMarches }] = await db.select({ n: sql<number>`count(distinct ${s.marches.acheteurId})::int` }).from(s.marches);
    return `${autonomes} acheteurs (soit ${pct(autonomes, avecMarches, 1)}%)`;
  },
  async fiches_a_jour() {
    const db = database();
    const [{ n: total }] = await db.select({ n: count() }).from(s.beneficiaires);
    const [{ n: ajour }] = await db.select({ n: count() }).from(s.beneficiaires).where(eq(s.beneficiaires.ficheAJour, true));
    return `${ajour} bénéficiaires (soit ${pct(ajour, total)}%)`;
  },
  async beneficiaires_actifs() {
    const [{ n }] = await database()
      .select({ n: count() })
      .from(s.beneficiaires)
      .innerJoin(s.utilisateurs, eq(s.utilisateurs.id, s.beneficiaires.utilisateurId))
      .where(and(gt(s.utilisateurs.derniereConnexionLe, SIX_MOIS as never), beneficiaireEligible));
    return String(n);
  },
  async acheteurs_actifs() {
    const [{ n }] = await database()
      .select({ n: sql<number>`count(distinct ${s.utilisateursAcheteurs.acheteurId})::int` })
      .from(s.utilisateursAcheteurs)
      .innerJoin(s.utilisateurs, eq(s.utilisateurs.id, s.utilisateursAcheteurs.utilisateurId))
      .where(gt(s.utilisateurs.derniereConnexionLe, SIX_MOIS as never));
    return String(n);
  },
  async repondants_actifs() {
    const [{ n }] = await database()
      .select({ n: count() })
      .from(s.repondants)
      .innerJoin(s.utilisateurs, eq(s.utilisateurs.id, s.repondants.utilisateurId))
      .where(gt(s.utilisateurs.derniereConnexionLe, SIX_MOIS as never));
    return String(n);
  },
  async clauses_activees() {
    const [{ n }] = await database().select({ n: count() }).from(s.marches).where(eq(s.marches.statut, 'clause_validee'));
    return String(n);
  },
  /** Bénéficiaires ayant au moins une déclaration (« profils uniques » de bénéficiaires d'un marché). */
  async beneficiaires_uniques() {
    const [{ n }] = await database().select({ n: sql<number>`count(distinct ${s.declarationsBeneficiaires.beneficiaireId})::int` }).from(s.declarationsBeneficiaires);
    return String(n);
  },
  async beneficiaires_commande_publique() {
    const [{ n }] = await database().select({ n: count() }).from(s.declarationsBeneficiaires);
    return String(n);
  },
};

export async function valeurIndicateur(code: string | null): Promise<string> {
  const compute = code && Object.hasOwn(INDICATEURS, code) ? INDICATEURS[code] : undefined;
  return compute ? compute() : '';
}
