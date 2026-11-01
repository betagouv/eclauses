import { eq, sql } from 'drizzle-orm';
import { database } from '../db/client';
import { beneficiaireADetruire, beneficiaireEligible, repondantADetruire } from '../db/expr';
import { beneficiaires, repondants, utilisateurs, utilisateursAcheteurs } from '../db/schema';
import type { Session } from './session';

/**
 * Détermine les rôles d'un compte. Un bénéficiaire doit être éligible et ne pas être à supprimer ;
 * un répondant ne doit pas être à supprimer ; un utilisateur acheteur n'a pas de condition.
 */
export async function resolveIdentity(userId: number, email: string): Promise<Session | null> {
  const db = database();
  const [[benef], [repondant], [acheteur]] = await Promise.all([
    db
      .select({ id: beneficiaires.id })
      .from(beneficiaires)
      .where(sql`${beneficiaires.utilisateurId} = ${userId} and ${beneficiaireEligible} and not ${beneficiaireADetruire}`),
    db
      .select({ id: repondants.id })
      .from(repondants)
      .innerJoin(utilisateurs, eq(utilisateurs.id, repondants.utilisateurId))
      .where(sql`${repondants.utilisateurId} = ${userId} and not ${repondantADetruire}`),
    db.select({ id: utilisateursAcheteurs.id, entiteId: utilisateursAcheteurs.acheteurId }).from(utilisateursAcheteurs).where(eq(utilisateursAcheteurs.utilisateurId, userId)),
  ]);
  const [account] = await db.select({ estAdmin: utilisateurs.estAdmin }).from(utilisateurs).where(eq(utilisateurs.id, userId));

  const roles: Session['roles'] = [];
  if (benef) roles.push('beneficiaire');
  if (repondant) roles.push('repondant');
  if (acheteur) roles.push('acheteur');
  if (account?.estAdmin) roles.push('admin');
  if (!roles.length) return null;

  return {
    email: email.trim().toLowerCase(),
    roles,
    beneficiaireId: benef?.id ?? null,
    repondantId: repondant?.id ?? null,
    acheteurId: acheteur?.id ?? null,
    acheteurEntiteId: acheteur?.entiteId ?? null,
  };
}
