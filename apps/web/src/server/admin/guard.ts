import type { Session } from '../auth/session';
import { currentSession, HttpError } from '../http';

/** Administrateur connecté ET ayant validé la double authentification, sinon refus. Toute action d'administration commence ici. */
export async function requireAdmin(): Promise<Session> {
  const session = await currentSession();
  if (!session) throw new HttpError(401, 'Authentification requise.');
  if (!session.roles.includes('admin')) throw new HttpError(403, 'Accès refusé.');
  if (!session.mfa) throw new HttpError(403, 'Double authentification requise.');
  return session;
}
