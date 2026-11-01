import { and, eq } from 'drizzle-orm';
import { database } from '../db/client';
import { notificationsEnvoyees } from '../db/schema';

/**
 * Mémoire durable des courriers déjà partis, un enregistrement par (événement, clé). `reserver`
 * est atomique : si deux traitements concurrents tentent le même envoi, un seul l'obtient.
 */
export async function reserver(evenement: string, cle: string | number): Promise<boolean> {
  const rows = await database().insert(notificationsEnvoyees).values({ evenement, cle: String(cle) }).onConflictDoNothing().returning({ id: notificationsEnvoyees.id });
  return rows.length > 0;
}

/** L'état qui déclenchait l'envoi a disparu : un nouvel envoi redevient possible. */
export async function liberer(evenement: string, cle: string | number): Promise<void> {
  await database().delete(notificationsEnvoyees).where(and(eq(notificationsEnvoyees.evenement, evenement), eq(notificationsEnvoyees.cle, String(cle))));
}

export async function dejaEnvoye(evenement: string, cle: string | number): Promise<boolean> {
  const [r] = await database().select({ id: notificationsEnvoyees.id }).from(notificationsEnvoyees).where(and(eq(notificationsEnvoyees.evenement, evenement), eq(notificationsEnvoyees.cle, String(cle))));
  return !!r;
}
