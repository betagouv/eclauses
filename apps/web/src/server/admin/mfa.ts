import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import QRCode from 'qrcode';
import { open, seal } from '../auth/secret-box';
import { generateSecret, otpauthUrl, verifyCode } from '../auth/totp';
import { database } from '../db/client';
import { codesSecours, utilisateurs } from '../db/schema';
import { HttpError } from '../http';
import { rateLimit } from '../http';
import { codeVerification } from '../mail/templates';
import { sendMail } from '../mail/transport';
import { utilisateurParEmail } from '../services/comptes';

/**
 * Double authentification des administrateurs, au choix : code à usage unique d'une application d'authentification
 * (`app`) ou code à 6 chiffres reçu par e-mail (`courrier`). Dans les deux cas : codes de secours, tentatives limitées
 * par compte, et un code déjà accepté ne se rejoue pas.
 */

export type MethodeMfa = 'app' | 'courrier';
const VALIDITE_CODE_COURRIER_MIN = 10;

const empreinte = (code: string) => createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
const fail = (status: number, message: string) => new HttpError(status, message);

async function compte(email: string) {
  const u = await utilisateurParEmail(email);
  if (!u?.estAdmin) throw fail(403, 'Accès refusé.');
  return u;
}

/** Un compte actif sans méthode enregistrée (activé avant l'option « courrier ») utilise l'application. */
const methodeDe = (u: { mfaMethode: string | null }): MethodeMfa => (u.mfaMethode === 'courrier' ? 'courrier' : 'app');

export async function statutMfa(email: string): Promise<{ active: boolean; methode: MethodeMfa }> {
  const u = await compte(email);
  return { active: !!u.totpActiveLe, methode: methodeDe(u) };
}

/** Empreinte du code reçu par courrier : HMAC lié au compte, avec la clé de chiffrement des secrets. */
function empreinteCourrier(userId: number, code: string): string {
  const hex = process.env.MFA_ENCRYPTION_KEY ?? '';
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error('Configuration invalide : MFA_ENCRYPTION_KEY doit contenir 64 caractères hexadécimaux.');
  return createHmac('sha256', Buffer.from(hex, 'hex')).update(`mfa-courrier:${userId}:${code}`).digest('hex');
}

/** Envoie un nouveau code par e-mail (l'éventuel code précédent n'est plus valable). */
export async function envoyerCodeCourrier(email: string): Promise<void> {
  const u = await compte(email);
  if (u.mfaMethode !== 'courrier') throw fail(409, 'La vérification par e-mail n’est pas choisie.');
  await rateLimit(`mfa-courrier:${u.id}`, 5, 15 * 60_000);
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await database()
    .update(utilisateurs)
    .set({ mfaCodeEmpreinte: empreinteCourrier(u.id, code), mfaCodeExpireLe: new Date(Date.now() + VALIDITE_CODE_COURRIER_MIN * 60_000) })
    .where(eq(utilisateurs.id, u.id));
  try {
    await sendMail({ to: u.email, ...codeVerification(code, VALIDITE_CODE_COURRIER_MIN) });
  } catch (e) {
    console.error('[mfa] envoi du code impossible', e instanceof Error ? e.message : e);
    throw fail(502, 'Le code n’a pas pu être envoyé par e-mail, réessayez dans un instant.');
  }
}

/** Accepte un code reçu par courrier s'il est valide et le consomme (deux requêtes simultanées ne passent pas toutes les deux). */
async function consommerCodeCourrier(u: { id: number; mfaCodeEmpreinte: string | null; mfaCodeExpireLe: Date | null }, code: string): Promise<boolean> {
  if (!u.mfaCodeEmpreinte || !u.mfaCodeExpireLe || u.mfaCodeExpireLe.getTime() < Date.now()) return false;
  const a = Buffer.from(u.mfaCodeEmpreinte);
  const b = Buffer.from(empreinteCourrier(u.id, code.replace(/\s/g, '')));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  const done = await database()
    .update(utilisateurs)
    .set({ mfaCodeEmpreinte: null, mfaCodeExpireLe: null })
    .where(and(eq(utilisateurs.id, u.id), eq(utilisateurs.mfaCodeEmpreinte, u.mfaCodeEmpreinte)))
    .returning({ id: utilisateurs.id });
  return done.length > 0;
}

/** Commence l'activation par e-mail : choisit la méthode et envoie un premier code, à saisir pour confirmer. */
export async function demarrerActivationCourrier(email: string): Promise<void> {
  const u = await compte(email);
  if (u.totpActiveLe) throw fail(409, 'La double authentification est déjà activée.');
  await rateLimit(`totp-demarrage:${u.id}`, 5, 60 * 60_000);
  await database().update(utilisateurs).set({ mfaMethode: 'courrier', totpSecretChiffre: null }).where(eq(utilisateurs.id, u.id));
  await envoyerCodeCourrier(email);
}

/** Commence l'activation : génère un secret (stocké chiffré, inactif tant qu'un code n'est pas confirmé). */
export async function demarrerActivation(email: string): Promise<{ secret: string; qrSvg: string }> {
  const u = await compte(email);
  if (u.totpActiveLe) throw fail(409, 'La double authentification est déjà activée.');
  await rateLimit(`totp-demarrage:${u.id}`, 5, 60 * 60_000);
  const secret = generateSecret();
  await database().update(utilisateurs).set({ totpSecretChiffre: seal(secret), mfaMethode: 'app', mfaCodeEmpreinte: null, mfaCodeExpireLe: null }).where(eq(utilisateurs.id, u.id));
  return { secret, qrSvg: await QRCode.toString(otpauthUrl(email, secret), { type: 'svg', margin: 1, width: 192 }) };
}

/** Confirme l'activation avec un premier code (application ou e-mail), et renvoie les codes de secours (visibles une seule fois). */
export async function confirmerActivation(email: string, code: string): Promise<{ codesSecours: string[] }> {
  const u = await compte(email);
  await rateLimit(`totp:${u.id}`, 5, 15 * 60_000);
  const parCourrier = u.mfaMethode === 'courrier';
  if (u.totpActiveLe || (parCourrier ? false : !u.totpSecretChiffre)) throw fail(409, 'Aucune activation en cours.');
  let step: number | null = null;
  if (parCourrier) {
    if (!(await consommerCodeCourrier(u, code))) throw fail(400, 'Code incorrect ou expiré.');
  } else {
    step = verifyCode(open(u.totpSecretChiffre!), code);
    if (step == null) throw fail(400, 'Code incorrect.');
  }
  const codes = Array.from({ length: 8 }, () => randomBytes(5).toString('hex').toUpperCase());
  await database().transaction(async (tx) => {
    await tx.update(utilisateurs).set({ totpActiveLe: new Date(), totpDernierPas: step, mfaMethode: parCourrier ? 'courrier' : 'app' }).where(eq(utilisateurs.id, u.id));
    await tx.delete(codesSecours).where(eq(codesSecours.utilisateurId, u.id));
    await tx.insert(codesSecours).values(codes.map((c) => ({ utilisateurId: u.id, empreinte: empreinte(c) })));
  });
  return { codesSecours: codes };
}

/** Vérifie un code (application d'authentification ou e-mail, selon la méthode du compte) ou un code de secours (consommé). */
export async function verifier(email: string, code: string): Promise<void> {
  const u = await compte(email);
  await rateLimit(`totp:${u.id}`, 5, 15 * 60_000);
  if (!u.totpActiveLe) throw fail(409, 'La double authentification n’est pas encore activée.');
  const value = String(code ?? '').trim();
  if (/^[\d\s]{6,7}$/.test(value)) {
    if (methodeDe(u) === 'courrier') {
      if (!(await consommerCodeCourrier(u, value))) throw fail(400, 'Code incorrect, expiré ou déjà utilisé.');
      return;
    }
    if (!u.totpSecretChiffre) throw fail(409, 'La double authentification n’est pas encore activée.');
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
    await tx.update(utilisateurs).set({ totpSecretChiffre: null, totpActiveLe: null, totpDernierPas: null, mfaMethode: null, mfaCodeEmpreinte: null, mfaCodeExpireLe: null }).where(eq(utilisateurs.id, userId));
    await tx.delete(codesSecours).where(eq(codesSecours.utilisateurId, userId));
  });
}
