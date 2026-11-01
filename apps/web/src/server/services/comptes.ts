import { createHash, randomBytes } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { database } from '../db/client';
import { jetonsAuth, utilisateurs } from '../db/schema';
import { hashPassword } from '../auth/password';
import { publicUrl } from '../mail/layout';

export type Objectif = 'activation' | 'reinitialisation';

const VALIDITE_MS: Record<Objectif, number> = {
  activation: 30 * 24 * 3600_000,
  reinitialisation: 24 * 3600_000,
};

const empreinte = (jeton: string) => createHash('sha256').update(jeton).digest('hex');
export const normaliser = (email: string) => email.trim().toLowerCase();

export async function utilisateurParEmail(email: string) {
  const [u] = await database().select().from(utilisateurs).where(sql`lower(${utilisateurs.email}) = ${normaliser(email)}`);
  return u;
}

/** Compte existant ou créé sans mot de passe (à activer par le lien reçu par courrier). */
export async function assurerUtilisateur(email: string): Promise<{ id: number; cree: boolean }> {
  const mail = normaliser(email);
  const existant = await utilisateurParEmail(mail);
  if (existant) return { id: existant.id, cree: false };
  const [u] = await database().insert(utilisateurs).values({ email: mail }).onConflictDoNothing().returning({ id: utilisateurs.id });
  if (u) return { id: u.id, cree: true };
  return { id: (await utilisateurParEmail(mail))!.id, cree: false };
}

export const lienReinitialisation = (jeton: string) => `${publicUrl()}/reset-password?token=${encodeURIComponent(jeton)}`;

/**
 * Nouveau jeton à usage unique. Les jetons encore valables du même objectif sont révoqués : un seul
 * lien actif par compte et par objectif. Seule l'empreinte est stockée ; le jeton en clair n'existe
 * que dans le courrier.
 */
export async function creerJeton(utilisateurId: number, objectif: Objectif): Promise<{ jeton: string; url: string }> {
  const jeton = randomBytes(32).toString('base64url');
  await database().transaction(async (tx) => {
    await tx.update(jetonsAuth).set({ utiliseLe: new Date() }).where(and(eq(jetonsAuth.utilisateurId, utilisateurId), eq(jetonsAuth.objectif, objectif), isNull(jetonsAuth.utiliseLe)));
    await tx.insert(jetonsAuth).values({ utilisateurId, objectif, empreinte: empreinte(jeton), expireLe: new Date(Date.now() + VALIDITE_MS[objectif]) });
  });
  return { jeton, url: lienReinitialisation(jeton) };
}

export interface EtatJeton {
  valide: boolean;
  utilise: boolean;
  objectif: Objectif | null;
  email: string | null;
  jetonId: number | null;
  utilisateurId: number | null;
}

export async function etatJeton(jeton: string): Promise<EtatJeton> {
  const vide: EtatJeton = { valide: false, utilise: false, objectif: null, email: null, jetonId: null, utilisateurId: null };
  if (jeton.length < 20 || jeton.length > 128) return vide;
  const [j] = await database()
    .select({ id: jetonsAuth.id, objectif: jetonsAuth.objectif, utiliseLe: jetonsAuth.utiliseLe, expireLe: jetonsAuth.expireLe, utilisateurId: jetonsAuth.utilisateurId, email: utilisateurs.email })
    .from(jetonsAuth)
    .innerJoin(utilisateurs, eq(utilisateurs.id, jetonsAuth.utilisateurId))
    .where(eq(jetonsAuth.empreinte, empreinte(jeton)));
  if (!j) return vide;
  const utilise = !!j.utiliseLe;
  return { valide: !utilise && j.expireLe > new Date(), utilise, objectif: j.objectif, email: j.email, jetonId: j.id, utilisateurId: j.utilisateurId };
}

/** Définit le mot de passe à partir d'un jeton valide, et consomme le jeton (une seule fois, même en concurrence). */
export async function consommerJeton(jeton: string, motDePasse: string): Promise<boolean> {
  const etat = await etatJeton(jeton);
  if (!etat.valide || !etat.jetonId || !etat.utilisateurId) return false;
  const hash = await hashPassword(motDePasse);
  return database().transaction(async (tx) => {
    const pris = await tx
      .update(jetonsAuth)
      .set({ utiliseLe: new Date() })
      .where(and(eq(jetonsAuth.id, etat.jetonId!), isNull(jetonsAuth.utiliseLe)))
      .returning({ id: jetonsAuth.id });
    if (!pris.length) return false;
    await tx.update(utilisateurs).set({ motDePasseHash: hash, motDePasseModifieLe: new Date() }).where(eq(utilisateurs.id, etat.utilisateurId!));
    return true;
  });
}

/** Supprime les jetons expirés ou utilisés depuis plus d'un jour. */
export async function purgerJetons(): Promise<number> {
  const rows = await database()
    .delete(jetonsAuth)
    .where(sql`${jetonsAuth.expireLe} < now() or ${jetonsAuth.utiliseLe} < now() - interval '1 day'`)
    .returning({ id: jetonsAuth.id });
  return rows.length;
}
