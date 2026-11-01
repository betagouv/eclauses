import { createHash, randomBytes } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import QRCode from 'qrcode';
import { open, seal } from '../auth/secret-box';
import { generateSecret, otpauthUrl, verifyCode } from '../auth/totp';
import { database } from '../db/client';
import { codesSecours, utilisateurs } from '../db/schema';
import { HttpError } from '../http';
import { rateLimit } from '../http';
import { utilisateurParEmail } from '../services/comptes';

/**
 * Double authentification des administrateurs : code à usage unique (application d'authentification) et codes de
 * secours. Les tentatives sont limitées par compte ; un code déjà accepté ne se rejoue pas.
 */

const empreinte = (code: string) => createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
const fail = (status: number, message: string) => new HttpError(status, message);

async function compte(email: string) {
  const u = await utilisateurParEmail(email);
  if (!u?.estAdmin) throw fail(403, 'Accès refusé.');
  return u;
}

export async function statutMfa(email: string): Promise<{ active: boolean }> {
  const u = await compte(email);
  return { active: !!u.totpActiveLe };
}

/** Commence l'activation : génère un secret (stocké chiffré, inactif tant qu'un code n'est pas confirmé). */
export async function demarrerActivation(email: string): Promise<{ secret: string; qrSvg: string }> {
  const u = await compte(email);
  if (u.totpActiveLe) throw fail(409, 'La double authentification est déjà activée.');
  const secret = generateSecret();
  await database().update(utilisateurs).set({ totpSecretChiffre: seal(secret) }).where(eq(utilisateurs.id, u.id));
  return { secret, qrSvg: await QRCode.toString(otpauthUrl(email, secret), { type: 'svg', margin: 1, width: 192 }) };
}

/** Confirme l'activation avec un premier code, et renvoie les codes de secours (visibles une seule fois). */
export async function confirmerActivation(email: string, code: string): Promise<{ codesSecours: string[] }> {
  const u = await compte(email);
  await rateLimit(`totp:${u.id}`, 5, 15 * 60_000);
  if (u.totpActiveLe || !u.totpSecretChiffre) throw fail(409, 'Aucune activation en cours.');
  const step = verifyCode(open(u.totpSecretChiffre), code);
  if (step == null) throw fail(400, 'Code incorrect.');
  const codes = Array.from({ length: 8 }, () => randomBytes(5).toString('hex').toUpperCase());
  await database().transaction(async (tx) => {
    await tx.update(utilisateurs).set({ totpActiveLe: new Date(), totpDernierPas: step }).where(eq(utilisateurs.id, u.id));
    await tx.delete(codesSecours).where(eq(codesSecours.utilisateurId, u.id));
    await tx.insert(codesSecours).values(codes.map((c) => ({ utilisateurId: u.id, empreinte: empreinte(c) })));
  });
  return { codesSecours: codes };
}

/** Vérifie un code de l'application d'authentification ou un code de secours (consommé). */
export async function verifier(email: string, code: string): Promise<void> {
  const u = await compte(email);
  await rateLimit(`totp:${u.id}`, 5, 15 * 60_000);
  if (!u.totpActiveLe || !u.totpSecretChiffre) throw fail(409, 'La double authentification n’est pas encore activée.');
  const value = String(code ?? '').trim();
  if (/^[\d\s]{6,7}$/.test(value)) {
    const step = verifyCode(open(u.totpSecretChiffre), value, Date.now(), u.totpDernierPas);
    if (step == null) throw fail(400, 'Code incorrect ou déjà utilisé.');
    // Mise à jour conditionnelle : deux requêtes simultanées avec le même code ne passent pas toutes les deux.
    const done = await database().update(utilisateurs).set({ totpDernierPas: step }).where(and(eq(utilisateurs.id, u.id), eq(utilisateurs.totpDernierPas, u.totpDernierPas ?? -1))).returning({ id: utilisateurs.id });
    if (!done.length && u.totpDernierPas != null) throw fail(400, 'Code incorrect ou déjà utilisé.');
    return;
  }
  const used = await database().update(codesSecours).set({ utiliseLe: new Date() }).where(and(eq(codesSecours.utilisateurId, u.id), eq(codesSecours.empreinte, empreinte(value)), isNull(codesSecours.utiliseLe))).returning({ id: codesSecours.id });
  if (!used.length) throw fail(400, 'Code incorrect ou déjà utilisé.');
}

/** Réinitialise la double authentification d'un administrateur (perte du téléphone) : il devra la réactiver à la prochaine connexion. */
export async function reinitialiser(userId: number): Promise<void> {
  await database().transaction(async (tx) => {
    await tx.update(utilisateurs).set({ totpSecretChiffre: null, totpActiveLe: null, totpDernierPas: null }).where(eq(utilisateurs.id, userId));
    await tx.delete(codesSecours).where(eq(codesSecours.utilisateurId, userId));
  });
}
