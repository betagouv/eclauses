import type { Row } from '../grist/client';
import type { Session } from '../auth/session';
import { grist } from '../config';
import { HttpError } from '../http';
import type { Actor } from './types';

export const truthy = (v: unknown) => v === true || v === 1 || v === '1';
export const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0);

export function requireActor(actor: Actor): Session {
  if (!actor) throw new HttpError(401, 'Authentification requise.');
  return actor;
}

export function requireRole<R extends Session['roles'][number]>(actor: Actor, role: R): Session {
  const s = requireActor(actor);
  if (!s.roles.includes(role)) throw new HttpError(403, 'Accès refusé.');
  return s;
}

export const forbidden = (message = 'Accès refusé.') => new HttpError(403, message);

export function pick(row: Row, cols: readonly string[]): Row {
  const out: Row = { id: row.id };
  for (const c of cols) if (c in row) out[c] = row[c];
  return out;
}

export function omit(row: Row, cols: readonly string[]): Row {
  const out: Row = { ...row };
  for (const c of cols) delete out[c];
  return out;
}

/** Identifiants d'une cellule de liste (avec ou sans marqueur « L »). */
export function listIds(v: unknown): number[] {
  return Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number') : [];
}

export const wanted = (ids: number[] | undefined, row: Row) => !ids || ids.includes(row.id);

export async function marcheById(id: number): Promise<Row | undefined> {
  if (!Number.isInteger(id) || id <= 0) return undefined;
  const [row] = await grist().records('Marches', { filter: { id: [id] } });
  return row;
}

/** Le marché appartient-il à l'entité de l'acheteur connecté ? */
export async function assertOwnMarche(session: Session, marcheId: number): Promise<Row> {
  const marche = await marcheById(marcheId);
  if (!marche || !session.acheteurEntiteId || num(marche.Acheteur) !== session.acheteurEntiteId) {
    throw forbidden('Ce marché ne relève pas de votre entité.');
  }
  return marche;
}

export const isTitulaire = (m: Row, s: Session) => !!s.repondantId && num(m.Titulaire) === s.repondantId;
export const isCandidat = (m: Row, s: Session) => !!s.repondantId && listIds(m.Candidats).includes(s.repondantId);
export const isInvolved = (m: Row, s: Session) => isTitulaire(m, s) || isCandidat(m, s);
