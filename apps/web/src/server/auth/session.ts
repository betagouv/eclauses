import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { database } from '../db/client';
import { sessions, utilisateurs } from '../db/schema';
import { resolveIdentity } from './identity';

export const SESSION_COOKIE = 'eclauses_session';
export const SESSION_TTL_SECONDS = 24 * 60 * 60;
const MFA_VALIDITE_MS = 12 * 60 * 60 * 1000;

export const sessionSchema = z.object({
  email: z.string().email(),
  roles: z.array(z.enum(['beneficiaire', 'repondant', 'acheteur', 'admin'])),
  beneficiaireId: z.number().int().nullable(),
  repondantId: z.number().int().nullable(),
  acheteurId: z.number().int().nullable(),
  acheteurEntiteId: z.number().int().nullable(),
  /** Administrateur : seconde étape validée dans cette session (jamais vrai pour les autres rôles). */
  mfa: z.boolean().optional(),
});

export type Session = z.infer<typeof sessionSchema>;

/**
 * Le navigateur ne porte qu'un identifiant aléatoire ; la base ne garde que son empreinte. Les rôles
 * sont recalculés à chaque requête : un compte devenu non éligible perd l'accès immédiatement, et une
 * session se révoque côté serveur (déconnexion, changement de mot de passe).
 */
const empreinte = (jeton: string) => createHash('sha256').update(jeton).digest('hex');

export async function createSession(utilisateurId: number): Promise<string> {
  const jeton = randomBytes(32).toString('base64url');
  await database().insert(sessions).values({ empreinte: empreinte(jeton), utilisateurId, expireLe: new Date(Date.now() + SESSION_TTL_SECONDS * 1000) });
  return jeton;
}

export async function readSession(jeton: string | undefined): Promise<Session | null> {
  if (!jeton || jeton.length < 20 || jeton.length > 128) return null;
  const [row] = await database()
    .select({ id: utilisateurs.id, email: utilisateurs.email, mfa: sessions.mfaValideLe })
    .from(sessions)
    .innerJoin(utilisateurs, eq(utilisateurs.id, sessions.utilisateurId))
    .where(and(eq(sessions.empreinte, empreinte(jeton)), isNull(sessions.revoqueLe), gt(sessions.expireLe, new Date())));
  if (!row) return null;
  const identity = await resolveIdentity(row.id, row.email);
  // La seconde étape ne vaut que pendant 12 h : un administrateur qui laisse une session ouverte doit la revalider.
  return identity ? { ...identity, mfa: !!row.mfa && Date.now() - row.mfa.getTime() < MFA_VALIDITE_MS } : null;
}

export async function revokeSession(jeton: string | undefined): Promise<void> {
  if (!jeton) return;
  await database().update(sessions).set({ revoqueLe: new Date() }).where(and(eq(sessions.empreinte, empreinte(jeton)), isNull(sessions.revoqueLe)));
}

/** Révoque toutes les sessions d'un compte (changement de mot de passe, retrait d'accès). */
export async function revokeAllSessions(utilisateurId: number): Promise<void> {
  await database().update(sessions).set({ revoqueLe: new Date() }).where(and(eq(sessions.utilisateurId, utilisateurId), isNull(sessions.revoqueLe)));
}

/** Enregistre que la seconde étape a été validée pour cette session. */
export async function markMfaValidated(jeton: string | undefined): Promise<void> {
  if (!jeton) return;
  await database().update(sessions).set({ mfaValideLe: new Date() }).where(and(eq(sessions.empreinte, empreinte(jeton)), isNull(sessions.revoqueLe)));
}
