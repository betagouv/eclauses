import { grist } from './config';
import { publicUrl } from './mail/layout';

/**
 * Crée une demande d'activation de compte (ligne `Application_Password_Reset`) et renvoie le lien à
 * envoyer par courrier. Le lien pointe vers cette application, avec le jeton calculé par Grist.
 */
export async function createActivation(email: string): Promise<{ id: number; url: string }> {
  const [id] = await grist().addRecords('Application_Password_Reset', [{ Email: email.trim().toLowerCase() }]);
  const [row] = await grist().records('Application_Password_Reset', { filter: { id: [id!] } });
  const token = String(row?.Token ?? '');
  if (!token) throw new Error("Jeton d'activation introuvable");
  return { id: id!, url: resetUrl(token) };
}

export const resetUrl = (token: string): string => `${publicUrl()}/reset-password?token=${encodeURIComponent(token)}`;

/** Garde trace de l'envoi sur la ligne d'activation, comme le faisait le flux n8n. */
export async function markActivationSent(id: number, error?: string): Promise<void> {
  await grist().updateRecords('Application_Password_Reset', [
    { id, fields: { create_send: true, ...(error ? { error_create_send: error } : {}) } },
  ]);
}
