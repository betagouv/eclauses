import { and, count, desc, eq, exists, ilike, isNotNull, isNull, ne, sql, type SQL } from 'drizzle-orm';
import type { Session } from '../auth/session';
import { database } from '../db/client';
import { beneficiaires, repondants, sessions, utilisateurs, utilisateursAcheteurs } from '../db/schema';
import { HttpError } from '../http';
import * as t from '../mail/templates';
import { sendMail } from '../mail/transport';
import { creerJeton } from '../services/comptes';
import { auditer } from './audit';
import { reinitialiser as reinitialiserMfaDe } from './mfa';

/** Gestion des comptes de connexion : consultation, liens par courrier, désactivation, droits d'administration. */

const fail = (status: number, message: string) => new HttpError(status, message);
export const PAGE_SIZE = 25;

export interface CompteRow {
  id: number;
  email: string;
  active: boolean;
  estAdmin: boolean;
  mfa: boolean;
  profils: ('beneficiaire' | 'repondant' | 'acheteur')[];
  derniereConnexionLe: string | null;
  creeLe: string;
}

export interface ComptesQuery {
  q?: string;
  etat?: 'actif' | 'non_active' | 'admin' | '';
  profil?: 'beneficiaire' | 'repondant' | 'acheteur' | '';
  page?: number;
}

const hasProfile = (table: 'beneficiaires' | 'repondants' | 'acheteurs') => {
  switch (table) {
    case 'beneficiaires':
      return exists(database().select({ x: sql`1` }).from(beneficiaires).where(eq(beneficiaires.utilisateurId, utilisateurs.id)));
    case 'repondants':
      return exists(database().select({ x: sql`1` }).from(repondants).where(eq(repondants.utilisateurId, utilisateurs.id)));
    case 'acheteurs':
      return exists(database().select({ x: sql`1` }).from(utilisateursAcheteurs).where(eq(utilisateursAcheteurs.utilisateurId, utilisateurs.id)));
  }
};

export async function lister(query: ComptesQuery = {}): Promise<{ rows: CompteRow[]; total: number; page: number; pages: number }> {
  const db = database();
  const conds: SQL[] = [];
  const term = query.q?.trim();
  if (term) conds.push(ilike(utilisateurs.email, `%${term.replace(/[%_\\]/g, (c) => `\\${c}`)}%`));
  if (query.etat === 'actif') conds.push(isNotNull(utilisateurs.motDePasseHash));
  if (query.etat === 'non_active') conds.push(isNull(utilisateurs.motDePasseHash));
  if (query.etat === 'admin') conds.push(eq(utilisateurs.estAdmin, true));
  if (query.profil === 'beneficiaire') conds.push(hasProfile('beneficiaires'));
  if (query.profil === 'repondant') conds.push(hasProfile('repondants'));
  if (query.profil === 'acheteur') conds.push(hasProfile('acheteurs'));
  const where = conds.length ? and(...conds) : undefined;
  const page = Math.max(1, Math.floor(query.page ?? 1));
  const [{ n }] = await db.select({ n: count() }).from(utilisateurs).where(where);
  const rows = await db
    .select({
      id: utilisateurs.id,
      email: utilisateurs.email,
      hash: utilisateurs.motDePasseHash,
      estAdmin: utilisateurs.estAdmin,
      mfa: utilisateurs.totpActiveLe,
      derniere: utilisateurs.derniereConnexionLe,
      cree: utilisateurs.creeLe,
      benef: hasProfile('beneficiaires'),
      rep: hasProfile('repondants'),
      ach: hasProfile('acheteurs'),
    })
    .from(utilisateurs)
    .where(where)
    .orderBy(desc(utilisateurs.id))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);
  return {
    total: n,
    page,
    pages: Math.max(1, Math.ceil(n / PAGE_SIZE)),
    rows: rows.map((r) => ({
      id: r.id,
      email: r.email,
      active: !!r.hash,
      estAdmin: r.estAdmin,
      mfa: !!r.mfa,
      profils: [...(r.benef ? (['beneficiaire'] as const) : []), ...(r.rep ? (['repondant'] as const) : []), ...(r.ach ? (['acheteur'] as const) : [])],
      derniereConnexionLe: r.derniere?.toISOString() ?? null,
      creeLe: r.cree.toISOString(),
    })),
  };
}

async function compte(userId: number) {
  const [u] = await database().select().from(utilisateurs).where(eq(utilisateurs.id, userId));
  if (!u) throw fail(404, 'Compte introuvable.');
  return u;
}

/** Lien d'activation (compte pas encore activé) : par courrier, avec le texte adapté au profil. */
export async function envoyerActivation(admin: Session, userId: number): Promise<void> {
  const u = await compte(userId);
  if (u.motDePasseHash) throw fail(409, 'Ce compte est déjà activé : envoyez plutôt un lien de réinitialisation.');
  const [b] = await database().select({ nom: beneficiaires.nom, prenom: beneficiaires.prenom }).from(beneficiaires).where(eq(beneficiaires.utilisateurId, userId));
  const { url } = await creerJeton(userId, 'activation');
  await sendMail({ to: u.email, ...(b ? t.accountInvitation([b.prenom, b.nom].filter(Boolean).join(' '), url) : t.finalizeInscription(url)) });
  await auditer(admin, 'compte.activation_envoyee', 'utilisateur', userId, { email: u.email });
}

export async function envoyerReinitialisation(admin: Session, userId: number): Promise<void> {
  const u = await compte(userId);
  const { url } = await creerJeton(userId, 'reinitialisation');
  await sendMail({ to: u.email, ...t.resetPassword(url) });
  await auditer(admin, 'compte.reinitialisation_envoyee', 'utilisateur', userId, { email: u.email });
}

/** Désactive la connexion (mot de passe retiré, sessions fermées). Le profil et l'historique restent ; un lien d'activation peut être renvoyé. */
export async function desactiver(admin: Session, userId: number): Promise<void> {
  const u = await compte(userId);
  const me = await database().select({ id: utilisateurs.id }).from(utilisateurs).where(eq(utilisateurs.email, admin.email));
  if (me[0]?.id === userId) throw fail(409, 'Vous ne pouvez pas désactiver votre propre compte.');
  await database().transaction(async (tx) => {
    await tx.update(utilisateurs).set({ motDePasseHash: null }).where(eq(utilisateurs.id, userId));
    await tx.update(sessions).set({ revoqueLe: new Date() }).where(and(eq(sessions.utilisateurId, userId), isNull(sessions.revoqueLe)));
  });
  await auditer(admin, 'compte.desactive', 'utilisateur', userId, { email: u.email });
}

/** Donne ou retire le droit d'administration. On ne modifie pas ses propres droits et on garde toujours au moins un administrateur. */
export async function definirAdmin(admin: Session, userId: number, estAdmin: boolean): Promise<void> {
  const u = await compte(userId);
  const [me] = await database().select({ id: utilisateurs.id }).from(utilisateurs).where(eq(utilisateurs.email, admin.email));
  if (me?.id === userId) throw fail(409, 'Vous ne pouvez pas modifier vos propres droits.');
  if (!estAdmin) {
    const [{ n }] = await database().select({ n: count() }).from(utilisateurs).where(and(eq(utilisateurs.estAdmin, true), ne(utilisateurs.id, userId)));
    if (n < 1) throw fail(409, 'Il doit rester au moins un administrateur.');
  }
  await database().transaction(async (tx) => {
    await tx.update(utilisateurs).set({ estAdmin }).where(eq(utilisateurs.id, userId));
    if (!estAdmin) await tx.update(sessions).set({ revoqueLe: new Date() }).where(and(eq(sessions.utilisateurId, userId), isNull(sessions.revoqueLe)));
  });
  if (!estAdmin) await reinitialiserMfaDe(userId);
  await auditer(admin, estAdmin ? 'compte.admin_accorde' : 'compte.admin_retire', 'utilisateur', userId, { email: u.email });
}

/** Perte du téléphone d'un administrateur : le secret est effacé, il devra réactiver la double authentification. */
export async function reinitialiserMfa(admin: Session, userId: number): Promise<void> {
  const u = await compte(userId);
  if (!u.estAdmin) throw fail(409, 'Ce compte n’est pas administrateur.');
  await reinitialiserMfaDe(userId);
  await database().update(sessions).set({ mfaValideLe: null }).where(eq(sessions.utilisateurId, userId));
  await auditer(admin, 'compte.mfa_reinitialisee', 'utilisateur', userId, { email: u.email });
}

