import { database } from '../db/client';
import { auditAdmin } from '../db/schema';
import type { Session } from '../auth/session';
import { utilisateurParEmail } from '../services/comptes';

/** Enregistre une action d'administration : qui, quoi, sur quelle entité, avec quels détails (jamais de mot de passe ni de secret). */
export async function auditer(admin: Session, action: string, entite: string, entiteId: string | number | null, details?: Record<string, unknown>): Promise<void> {
  const user = await utilisateurParEmail(admin.email);
  await database().insert(auditAdmin).values({ utilisateurId: user?.id ?? null, email: admin.email, action, entite, entiteId: entiteId == null ? null : String(entiteId), details: details ?? null });
}
