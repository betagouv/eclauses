import { grist } from '../config';
import type { Row } from './client';
import { HttpError } from '../http';

export interface ColumnInfo {
  type: string;
  isFormula: boolean;
}

const TTL_MS = 10 * 60_000;
const cache = new Map<string, { at: number; cols: Map<string, ColumnInfo> }>();

/** Colonnes d'une table (type et formule), mises en cache : le schéma change rarement. */
export async function columnsOf(table: string): Promise<Map<string, ColumnInfo>> {
  const hit = cache.get(table);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.cols;
  const cols = new Map<string, ColumnInfo>();
  for (const c of await grist().columns(table)) cols.set(c.id, { type: c.type, isFormula: c.isFormula });
  cache.set(table, { at: Date.now(), cols });
  return cols;
}

const LIST_TYPES = new Set(['RefList', 'ChoiceList', 'Attachments']);
const isListType = (t: string) => LIST_TYPES.has(t.split(':')[0]!);

/**
 * Valeurs lues dans le format du widget Grist (`fetchTable`) : listes sans marqueur « L », liste vide
 * plutôt que `null`. Les pages existantes attendent ce format.
 */
export async function decodeRows(table: string, rows: Row[]): Promise<Row[]> {
  const cols = await columnsOf(table);
  return rows.map((row) => {
    const out: Row = { ...row };
    for (const [id, info] of cols) {
      if (!(id in out) || !isListType(info.type)) continue;
      const v = out[id];
      out[id] = Array.isArray(v) ? (v[0] === 'L' ? v.slice(1) : v) : [];
    }
    return out;
  });
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Valeur envoyée par une page -> valeur attendue par l'API REST de Grist. */
export function encodeValue(type: string, value: unknown): unknown {
  if (value === undefined) return null;
  if (isListType(type)) {
    if (value === null) return ['L'];
    if (Array.isArray(value)) return value[0] === 'L' ? value : ['L', ...value];
    return ['L', value];
  }
  if (type.startsWith('DateTime') || type === 'Date') {
    if (typeof value === 'string' && value !== '') {
      const ms = Date.parse(ISO_DATE.test(value) ? `${value}T00:00:00Z` : value);
      return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
    }
    return value === '' ? null : value;
  }
  return value;
}

/**
 * Prépare des champs à écrire : refuse les colonnes inconnues ou calculées, puis encode chaque valeur.
 * `allowed` restreint en plus aux colonnes autorisées pour le rôle qui écrit.
 */
export async function prepareFields(
  table: string,
  fields: Record<string, unknown>,
  allowed?: ReadonlySet<string>,
): Promise<Record<string, unknown>> {
  const cols = await columnsOf(table);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    const info = cols.get(key);
    if (!info) throw new HttpError(400, `Colonne inconnue : ${key}`);
    if (info.isFormula) throw new HttpError(400, `Colonne calculée, non modifiable : ${key}`);
    if (allowed && !allowed.has(key)) throw new HttpError(400, `Colonne non modifiable : ${key}`);
    out[key] = encodeValue(info.type, value);
  }
  return out;
}
