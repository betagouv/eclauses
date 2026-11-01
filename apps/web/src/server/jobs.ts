import { and, eq, isNull, sql } from 'drizzle-orm';
import { database } from './db/client';
import { beneficiaireADetruire, beneficiaireEligible, repondantADetruire } from './db/expr';
import { beneficiaires, fichiers, limitesDebit, marches, repondants, sessions, utilisateurs } from './db/schema';
import { purgerJetons } from './services/comptes';
import { supprimerFichier } from './services/fichiers';
import { inviterBeneficiaires } from './services/notifications';

export interface JobResult {
  job: string;
  processed: number;
}

const today = () => new Date().toISOString().slice(0, 10);

/** Supprime les liens d'activation et de réinitialisation expirés ou utilisés. */
async function purgeResets(): Promise<JobResult> {
  return { job: 'purge-resets', processed: await purgerJetons() };
}

/** Efface les sessions expirées ou révoquées et les compteurs du limiteur échus. */
async function purgeSessions(): Promise<JobResult> {
  const rows = await database().delete(sessions).where(sql`${sessions.expireLe} < now() or ${sessions.revoqueLe} is not null`).returning({ e: sessions.empreinte });
  const counters = await database().delete(limitesDebit).where(sql`${limitesDebit.finFenetre} < now()`).returning({ k: limitesDebit.cle });
  return { job: 'purge-sessions', processed: rows.length + counters.length };
}

/** Bénéficiaires dont la durée de conservation est dépassée : données personnelles et compte effacés. */
async function anonymiseBeneficiaires(): Promise<JobResult> {
  const db = database();
  const rows = await db
    .select({ id: beneficiaires.id, userId: beneficiaires.utilisateurId, cv: beneficiaires.cvFichierId })
    .from(beneficiaires)
    .where(and(beneficiaireADetruire, isNull(beneficiaires.anonymiseLe)));
  for (const r of rows) {
    await db.transaction(async (tx) => {
      await tx
        .update(beneficiaires)
        .set({
          nom: `Beneficiaire #${r.id}`,
          prenom: null,
          telephone: null,
          formationId: null,
          autreFormation: null,
          anneeDiplome: null,
          specialiteEcole: null,
          sousSpecialite: null,
          intituleMemoire: null,
          autresInformations: null,
          cvFichierId: null,
          utilisateurId: null,
          anonymiseLe: today(),
        })
        .where(eq(beneficiaires.id, r.id));
      if (r.userId) await tx.delete(utilisateurs).where(eq(utilisateurs.id, r.userId));
    });
    if (r.cv) await supprimerFichier(r.cv);
  }
  return { job: 'anonymise-beneficiaires', processed: rows.length };
}

/** Répondants à supprimer : données effacées et compte de connexion supprimé. */
async function anonymiseRepondants(): Promise<JobResult> {
  const db = database();
  const rows = await db
    .select({ id: repondants.id, userId: repondants.utilisateurId })
    .from(repondants)
    .innerJoin(utilisateurs, eq(utilisateurs.id, repondants.utilisateurId))
    .where(repondantADetruire);
  for (const r of rows) {
    await db.transaction(async (tx) => {
      await tx.update(repondants).set({ nom: `Repondant #${r.id}`, prenom: null, telephone: null, raisonSociale: null, siret: null, utilisateurId: null, anonymiseLe: today() }).where(eq(repondants.id, r.id));
      if (r.userId) await tx.delete(utilisateurs).where(eq(utilisateurs.id, r.userId));
    });
  }
  return { job: 'anonymise-repondants', processed: rows.length };
}

/** Bénéficiaires devenus non éligibles : leur accès est retiré (le compte perd son mot de passe, la fiche reste). */
async function deleteIneligibleAccounts(): Promise<JobResult> {
  const db = database();
  const rows = await db
    .select({ userId: utilisateurs.id })
    .from(beneficiaires)
    .innerJoin(utilisateurs, eq(utilisateurs.id, beneficiaires.utilisateurId))
    .where(and(sql`not ${beneficiaireEligible}`, sql`${utilisateurs.motDePasseHash} is not null`));
  for (const r of rows) {
    await db.update(utilisateurs).set({ motDePasseHash: null }).where(eq(utilisateurs.id, r.userId));
    await db.delete(sessions).where(eq(sessions.utilisateurId, r.userId));
  }
  return { job: 'delete-ineligible-accounts', processed: rows.length };
}

/** Marchés validés dont l'exécution est terminée depuis plus de quatre ans et demi : archivés. */
async function archiveMarches(): Promise<JobResult> {
  const rows = await database()
    .update(marches)
    .set({ statut: 'archive', modifieLe: new Date() })
    .where(and(eq(marches.statut, 'clause_validee'), sql`${marches.dateFinExecution} + interval '4 years 6 months' < current_date`))
    .returning({ id: marches.id });
  return { job: 'archive-marches', processed: rows.length };
}

/** Fichiers déposés mais jamais rattachés à une fiche (dépôt interrompu) depuis plus d'un jour : supprimés. */
async function purgeFichiers(): Promise<JobResult> {
  const orphelins = await database()
    .select({ id: fichiers.id })
    .from(fichiers)
    .where(and(sql`${fichiers.creeLe} < now() - interval '1 day'`, sql`not exists (select 1 from beneficiaires b where b.cv_fichier_id = ${fichiers.id})`));
  for (const f of orphelins) await supprimerFichier(f.id);
  return { job: 'purge-fichiers', processed: orphelins.length };
}

/** Invitations à créer son espace, pour les bénéficiaires dont le compte n'est pas encore activé. */
async function invitationsComptes(): Promise<JobResult> {
  return { job: 'invitations-comptes', processed: await inviterBeneficiaires() };
}

export const JOBS: Record<string, () => Promise<JobResult>> = {
  'purge-resets': purgeResets,
  'purge-sessions': purgeSessions,
  'anonymise-beneficiaires': anonymiseBeneficiaires,
  'anonymise-repondants': anonymiseRepondants,
  'delete-ineligible-accounts': deleteIneligibleAccounts,
  'archive-marches': archiveMarches,
  'purge-fichiers': purgeFichiers,
  'invitations-comptes': invitationsComptes,
};
