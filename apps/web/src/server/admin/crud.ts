import { and, asc, count, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import type { Session } from '../auth/session';
import { database } from '../db/client';
import { utilisateurs } from '../db/schema';
import { HttpError } from '../http';
import { assurerUtilisateur, normaliser, utilisateurParEmail } from '../services/comptes';
import { auditer } from './audit';
import { RESOURCES, resourceByKey } from './resources';
import type { Field, Resource } from './types';

/**
 * Moteur commun des écrans d'administration : lecture paginée avec recherche et filtres, lecture d'une ligne,
 * enregistrement (validé champ par champ, listes liées, compte de connexion) et suppression, avec journal d'audit.
 * Les droits sont vérifiés par l'appelant (`requireAdmin`) : ces fonctions ne se fient à aucune donnée du navigateur.
 */

export type Row = Record<string, unknown>;
export const PAGE_SIZE = 25;

const col = (r: Resource, prop: string): PgColumn => {
  const c = (r.table as unknown as Record<string, PgColumn | undefined>)[prop];
  if (!c) throw new Error(`Colonne inconnue : ${r.key}.${prop}`);
  return c;
};
const idCol = (r: Resource) => col(r, r.idProp ?? 'id');
const isTextId = (r: Resource) => !!r.idProp && r.idProp !== 'id';
const fail = (status: number, message: string) => new HttpError(status, message);

export function resourceOrThrow(key: string): Resource {
  const r = resourceByKey(key);
  if (!r) throw fail(404, 'Ressource inconnue.');
  return r;
}

/** Valeur JSON-compatible : les instants deviennent des chaînes ISO. */
const plain = (v: unknown): unknown => (v instanceof Date ? v.toISOString() : v);
const clean = (row: Record<string, unknown>): Row => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, plain(v)]));

export const labelOf = (r: Resource, row: Row): string => r.labelProps.map((p) => row[p]).filter((v) => v != null && v !== '').join(' ') || `#${String(row[r.idProp ?? 'id'])}`;

/* ------------------------------------------------------------------ Lecture ------------------- */

export interface ListQuery {
  q?: string;
  page?: number;
  filters?: Record<string, string>;
}
export interface ListResult {
  rows: Row[];
  total: number;
  page: number;
  pages: number;
}

function filterConditions(r: Resource, q: ListQuery): SQL[] {
  const conds: SQL[] = [];
  const term = q.q?.trim();
  if (term) {
    const like = `%${term.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    const parts: SQL[] = r.search.map((p) => ilike(sql`${col(r, p)}::text`, like));
    if (r.account) parts.push(inArray(col(r, r.account.fkProp), sql`(select id from utilisateurs where email ilike ${like})`));
    if (!isTextId(r) && /^\d+$/.test(term)) parts.push(eq(idCol(r), Number(term)));
    if (parts.length) conds.push(or(...parts)!);
  }
  for (const [name, value] of Object.entries(q.filters ?? {})) {
    const f = r.fields.find((x) => x.name === name);
    if (!f || value === '') continue;
    if (f.type === 'bool') conds.push(eq(col(r, name), value === '1' || value === 'true'));
    else if (f.type === 'enum' && f.options && value in f.options) conds.push(eq(col(r, name), value));
    else if (f.type === 'ref' && /^\d+$/.test(value)) conds.push(eq(col(r, name), Number(value)));
  }
  return conds;
}

async function attachEmails(r: Resource, rows: Row[]): Promise<void> {
  if (!r.account) return;
  const ids = [...new Set(rows.map((x) => x[r.account!.fkProp]).filter((x): x is number => typeof x === 'number'))];
  const users = ids.length ? await database().select({ id: utilisateurs.id, email: utilisateurs.email, actif: utilisateurs.motDePasseHash }).from(utilisateurs).where(inArray(utilisateurs.id, ids)) : [];
  const byId = new Map(users.map((u) => [u.id, u]));
  for (const row of rows) {
    const u = byId.get(row[r.account.fkProp] as number);
    row.email = u?.email ?? '';
    row.compteActive = !!u?.actif;
  }
}

/** Libellés des lignes désignées par les champs `ref` des colonnes de liste (un seul accès par ressource liée). */
export async function refLabels(r: Resource, rows: Row[]): Promise<Record<string, Record<string, string>>> {
  const out: Record<string, Record<string, string>> = {};
  for (const f of r.fields.filter((x) => x.type === 'ref' && x.list)) {
    const target = resourceOrThrow(f.ref!);
    const ids = [...new Set(rows.map((x) => x[f.name]).filter((x): x is number => typeof x === 'number'))];
    if (!ids.length) continue;
    const found = (await database().select().from(target.table as never).where(inArray(idCol(target), ids))) as Row[];
    out[f.name] = Object.fromEntries(found.map((row) => [String(row[target.idProp ?? 'id']), labelOf(target, row)]));
  }
  return out;
}

export async function list(r: Resource, query: ListQuery = {}): Promise<ListResult & { labels: Record<string, Record<string, string>> }> {
  const db = database();
  const where = filterConditions(r, query);
  const page = Math.max(1, Math.floor(query.page ?? 1));
  const cond = where.length ? and(...where) : undefined;
  const [{ n }] = await db.select({ n: count() }).from(r.table as never).where(cond);
  const order = r.orderBy ? [asc(col(r, r.orderBy)), asc(idCol(r))] : [asc(idCol(r))];
  const raw = (await db.select().from(r.table as never).where(cond).orderBy(...order).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE)) as Row[];
  const rows = raw.map((x) => ({ ...clean(x), __label: labelOf(r, x) }));
  await attachEmails(r, rows);
  return { rows, total: n, page, pages: Math.max(1, Math.ceil(n / PAGE_SIZE)), labels: await refLabels(r, rows) };
}

export async function get(r: Resource, id: string | number): Promise<Row | null> {
  const db = database();
  const key = isTextId(r) ? String(id) : Number(id);
  if (!isTextId(r) && !Number.isInteger(key)) return null;
  const [raw] = (await db.select().from(r.table as never).where(eq(idCol(r), key))) as Row[];
  if (!raw) return null;
  const row: Row = { ...clean(raw), __label: labelOf(r, raw) };
  await attachEmails(r, [row]);
  for (const f of r.fields.filter((x) => x.type === 'multi')) {
    const j = f.join!;
    const links = (await db.select().from(j.table as never).where(eq((j.table as unknown as Record<string, PgColumn>)[j.owner]!, key as number))) as Row[];
    row[f.name] = links.map((l) => l[j.other] as number);
  }
  return row;
}

export interface Option {
  value: string;
  label: string;
}

/** Choix proposés par un champ `ref` ou `multi` (libellé = assemblage des propriétés de libellé de la ressource liée). */
export async function options(key: string): Promise<Option[]> {
  const r = resourceOrThrow(key);
  const rows = (await database().select().from(r.table as never).orderBy(...(r.orderBy ? [asc(col(r, r.orderBy))] : []), asc(idCol(r))).limit(3000)) as Row[];
  return rows.map((row) => ({ value: String(row[r.idProp ?? 'id']), label: labelOf(r, row) }));
}

/* ------------------------------------------------------------------ Écriture ------------------- */

type Input = Record<string, unknown>;

function coerce(f: Field, raw: unknown): unknown {
  const blank = raw === undefined || raw === null || raw === '' || (Array.isArray(raw) && f.type !== 'multi' && !raw.length);
  const required = () => {
    if (f.required && blank) throw fail(400, `« ${f.label} » est obligatoire.`);
  };
  switch (f.type) {
    case 'text':
    case 'textarea': {
      if (blank) return required(), null;
      const v = String(raw).trim();
      if (!v) return required(), null;
      if (v.length > (f.max ?? (f.type === 'text' ? 1000 : 20000))) throw fail(400, `« ${f.label} » est trop long.`);
      return v;
    }
    case 'number': {
      if (blank) return required(), null;
      const n = Number(raw);
      if (!Number.isFinite(n)) throw fail(400, `« ${f.label} » doit être un nombre.`);
      return n;
    }
    case 'bool':
      return raw === true || raw === 'true' || raw === 1 || raw === '1';
    case 'date': {
      if (blank) return required(), null;
      const v = String(raw);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) throw fail(400, `« ${f.label} » : date invalide (AAAA-MM-JJ).`);
      return v;
    }
    case 'datetime':
      return undefined; // jamais saisi à la main
    case 'enum': {
      if (blank) return required(), null;
      if (!f.options || !(String(raw) in f.options)) throw fail(400, `« ${f.label} » : valeur inconnue.`);
      return String(raw);
    }
    case 'ref': {
      if (blank) return required(), null;
      const n = Number(raw);
      if (!Number.isInteger(n) || n <= 0) throw fail(400, `« ${f.label} » : choix invalide.`);
      return n;
    }
    case 'multi': {
      if (blank) return [];
      const arr = Array.isArray(raw) ? raw : [raw];
      const ids = arr.map(Number);
      if (ids.some((n) => !Number.isInteger(n) || n <= 0)) throw fail(400, `« ${f.label} » : choix invalide.`);
      return [...new Set(ids)];
    }
  }
}

/** Traduit les erreurs de contrainte de PostgreSQL en messages lisibles. */
function dbError(e: unknown): never {
  const code = (e as { cause?: { code?: string } }).cause?.code;
  if (code === '23505') throw fail(409, 'Une ligne identique existe déjà (valeur en doublon).');
  if (code === '23503') throw fail(409, 'Cette valeur désigne un élément inexistant, ou l’élément est encore utilisé ailleurs.');
  if (code === '23502') throw fail(400, 'Un champ obligatoire est vide.');
  if (code === '22P02' || code === '22003' || code === '22007') throw fail(400, 'Une valeur n’a pas le bon format.');
  throw e;
}

export interface SaveResult {
  id: string | number;
}

/**
 * Crée (`id` absent) ou modifie une ligne. Seuls les champs décrits par la ressource et non « lecture seule » sont lus ;
 * toute autre entrée est ignorée. Le compte de connexion (e-mail) et les listes liées sont gérés dans la même transaction.
 */
export async function save(admin: Session, r: Resource, id: string | number | null, input: Input): Promise<SaveResult> {
  if (r.readOnly) throw fail(403, 'Cette ressource est en lecture seule.');
  if (id == null && !r.canCreate) throw fail(403, 'La création n’est pas permise ici.');
  const editable = r.fields.filter((f) => !f.readonly && f.type !== 'datetime');
  const scalars: Row = {};
  const lists: Record<string, number[]> = {};
  for (const f of editable) {
    // En modification, un champ absent de la saisie n'est pas touché ; en création il prend sa valeur par défaut.
    if (id != null && !(f.name in input)) continue;
    const value = coerce(f, input[f.name]);
    if (f.type === 'multi') lists[f.name] = value as number[];
    // En création, une valeur vide n'est pas écrite : la colonne prend sa valeur par défaut (ou reste vide si elle est facultative).
    else if (value !== undefined && !(id == null && value === null)) scalars[f.name] = value;
  }
  // Clé texte (paramètres) : la clé se saisit à la création, jamais ensuite.
  if (isTextId(r) && id != null) delete scalars[r.idProp!];

  const before = id != null ? await get(r, id) : null;
  if (id != null && !before) throw fail(404, 'Élément introuvable.');
  const email = r.account && 'email' in input ? String(input.email ?? '').trim() : undefined;
  if (r.account?.required && id == null && !email) throw fail(400, 'L’adresse e-mail est obligatoire.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fail(400, 'Adresse e-mail invalide.');

  let savedId: string | number;
  try {
    savedId = await database().transaction(async (tx) => {
      if (r.account && email !== undefined) {
        const fk = r.account.fkProp;
        const current = before ? (before[fk] as number | null) : null;
        if (!email) {
          if (id != null && current) throw fail(400, 'L’adresse e-mail ne peut pas être retirée : le compte serait orphelin.');
        } else if (!current) {
          scalars[fk] = (await assurerUtilisateur(email)).id;
        } else {
          const existing = await utilisateurParEmail(email);
          if (existing && existing.id !== current) throw fail(409, 'Cette adresse appartient déjà à un autre compte : utilisez la fusion de doublons.');
          if (!existing) await tx.update(utilisateurs).set({ email: normaliser(email) }).where(eq(utilisateurs.id, current));
        }
      }
      let rowId: string | number;
      if (id == null) {
        const [created] = (await tx.insert(r.table as never).values(scalars as never).returning({ id: idCol(r) })) as { id: string | number }[];
        rowId = created!.id;
      } else {
        rowId = id;
        if (Object.keys(scalars).length) await tx.update(r.table as never).set(scalars as never).where(eq(idCol(r), isTextId(r) ? String(id) : Number(id)));
      }
      for (const f of r.fields.filter((x) => x.type === 'multi' && x.name in lists)) {
        const j = f.join!;
        const ownerCol = (j.table as unknown as Record<string, PgColumn>)[j.owner]!;
        await tx.delete(j.table as never).where(eq(ownerCol, rowId as number));
        if (lists[f.name]!.length) await tx.insert(j.table as never).values(lists[f.name]!.map((o) => ({ [j.owner]: rowId, [j.other]: o })) as never);
      }
      return rowId;
    });
  } catch (e) {
    if (e instanceof HttpError) throw e;
    return dbError(e);
  }

  // Journal : champs modifiés (avant -> après), sans la valeur des textes longs ni des champs internes.
  const changes: Record<string, unknown> = {};
  for (const f of editable) {
    const next = f.type === 'multi' ? lists[f.name] : scalars[f.name];
    if (next === undefined) continue;
    const prev = before?.[f.name];
    if (JSON.stringify(prev ?? (f.type === 'multi' ? [] : null)) === JSON.stringify(next)) continue;
    changes[f.name] = f.noAudit ? 'modifié' : id == null ? next : [prev ?? null, next];
  }
  if (email) changes.email = id == null || before?.email !== email ? (id == null ? email : [before?.email ?? null, email]) : undefined;
  await auditer(admin, id == null ? 'creation' : 'modification', r.key, savedId, Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined)));
  return { id: savedId };
}

export async function remove(admin: Session, r: Resource, id: string | number): Promise<void> {
  if (r.readOnly || !r.canDelete) throw fail(403, 'La suppression n’est pas permise ici.');
  const before = await get(r, id);
  if (!before) throw fail(404, 'Élément introuvable.');
  try {
    await database().delete(r.table as never).where(eq(idCol(r), isTextId(r) ? String(id) : Number(id)));
  } catch (e) {
    return dbError(e);
  }
  await auditer(admin, 'suppression', r.key, id, { libelle: before.__label });
}

export { RESOURCES };
