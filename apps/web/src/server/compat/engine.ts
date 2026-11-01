import { and, eq, inArray, type SQL } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import { database } from '../db/client';
import { toDate, toDay, toEpoch } from '../db/convert';
import { HttpError } from '../http';

/**
 * Couche de compatibilité : présente les lignes de PostgreSQL dans la forme que les pages héritées
 * de Grist attendent (noms de colonnes d'origine, listes d'identifiants, dates en secondes, statuts
 * en libellés) et traduit leurs écritures. Elle disparaît page par page (phase 5).
 */
export type Row = { id: number } & Record<string, unknown>;

type Kind = 'text' | 'texts' | 'num' | 'year' | 'bool' | 'date' | 'ts' | 'ref' | 'enum';

export interface Field {
  /** Propriété Drizzle de la colonne. */
  prop: string;
  kind: Kind;
  /** Pour `enum` : code stocké -> libellé affiché. */
  labels?: Record<string, string>;
  /** Jamais écrit depuis les pages (même si le rôle le pourrait). */
  readonly?: boolean;
}

export interface ListField {
  /** Table de jointure. */
  table: PgTable;
  /** Colonnes de la jointure : propriétaire et élément. */
  owner: string;
  other: string;
}

export interface TableSpec {
  table: PgTable;
  fields: Record<string, Field>;
  lists?: Record<string, ListField>;
  /** Champs calculés (formules de Grist) : ajoutés aux lignes lues. */
  computed?: (rows: Row[]) => Promise<void>;
}

const col = (table: PgTable, prop: string): PgColumn => (table as unknown as Record<string, PgColumn>)[prop]!;

function readValue(f: Field, v: unknown): unknown {
  switch (f.kind) {
    case 'text':
      return v ?? '';
    case 'texts':
      return Array.isArray(v) ? v : [];
    case 'num':
    case 'ref':
      return v ?? 0;
    case 'year':
      return v == null ? '' : String(v);
    case 'bool':
      return !!v;
    case 'date':
    case 'ts':
      return toEpoch(v as string | Date | null);
    case 'enum':
      return v == null ? '' : (f.labels?.[String(v)] ?? String(v));
  }
}

function writeValue(name: string, f: Field, v: unknown): unknown {
  const bad = () => new HttpError(400, `Valeur invalide : ${name}`);
  switch (f.kind) {
    case 'text':
      if (v == null || v === '') return null;
      if (typeof v !== 'string' && typeof v !== 'number') throw bad();
      return String(v);
    case 'texts':
      if (v == null) return null;
      if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) throw bad();
      return v[0] === 'L' ? v.slice(1) : v;
    case 'num':
    case 'year': {
      if (v == null || v === '') return null;
      const n = Number(v);
      if (!Number.isFinite(n) || (f.kind === 'year' && !Number.isInteger(n))) throw bad();
      return n;
    }
    case 'ref': {
      if (v == null || v === 0 || v === '') return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n <= 0) throw bad();
      return n;
    }
    case 'bool':
      if (v === true || v === 1 || v === '1') return true;
      if (v === false || v === 0 || v === '0' || v == null) return false;
      throw bad();
    case 'date': {
      const d = toDay(v);
      if (d === undefined) throw bad();
      return d;
    }
    case 'ts': {
      const d = toDate(v);
      if (d === undefined) throw bad();
      return d;
    }
    case 'enum': {
      const labels = f.labels ?? {};
      const code = Object.entries(labels).find(([, label]) => label === v)?.[0] ?? (typeof v === 'string' && v in labels ? v : undefined);
      if (!code) throw bad();
      return code;
    }
  }
}

export class LegacyTable {
  constructor(readonly spec: TableSpec) {}

  /** Lignes au format des pages ; `where` et `ids` restreignent la lecture. */
  async read(opts: { where?: SQL; ids?: number[] } = {}): Promise<Row[]> {
    const { table, fields, lists, computed } = this.spec;
    const db = database();
    const conds: SQL[] = [];
    if (opts.where) conds.push(opts.where);
    if (opts.ids) {
      if (!opts.ids.length) return [];
      conds.push(inArray(col(table, 'id'), opts.ids));
    }
    const raw = (await db
      .select()
      .from(table as never)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(col(table, 'id'))) as Record<string, unknown>[];

    const rows: Row[] = raw.map((r) => {
      const row: Row = { id: r.id as number };
      for (const [name, f] of Object.entries(fields)) row[name] = readValue(f, r[f.prop]);
      return row;
    });

    if (lists && rows.length) {
      const ids = rows.map((r) => r.id);
      for (const [name, l] of Object.entries(lists)) {
        const links = (await db
          .select()
          .from(l.table as never)
          .where(inArray(col(l.table, l.owner), ids))) as Record<string, number>[];
        const byOwner = new Map<number, number[]>();
        for (const link of links) {
          const o = link[l.owner]!;
          byOwner.set(o, [...(byOwner.get(o) ?? []), link[l.other]!]);
        }
        for (const row of rows) row[name] = byOwner.get(row.id) ?? [];
      }
    }
    if (computed && rows.length) await computed(rows);
    return rows;
  }

  async byId(id: number): Promise<Row | undefined> {
    if (!Number.isInteger(id) || id <= 0) return undefined;
    return (await this.read({ ids: [id] }))[0];
  }

  /**
   * Valeurs à écrire à partir de champs venus d'une page : refuse les noms inconnus, calculés ou non
   * autorisés pour le rôle (`allowed`).
   */
  parse(input: Record<string, unknown>, allowed?: ReadonlySet<string>) {
    const values: Record<string, unknown> = {};
    const listValues: Record<string, number[]> = {};
    for (const [name, raw] of Object.entries(input)) {
      const f = this.spec.fields[name];
      const l = this.spec.lists?.[name];
      if (!f && !l) throw new HttpError(400, `Colonne inconnue ou calculée : ${name}`);
      if (allowed && !allowed.has(name)) throw new HttpError(400, `Colonne non modifiable : ${name}`);
      if (f) {
        if (f.readonly) throw new HttpError(400, `Colonne non modifiable : ${name}`);
        values[f.prop] = writeValue(name, f, raw);
      } else {
        const v = raw == null ? [] : Array.isArray(raw) ? raw[0] === 'L' ? raw.slice(1) : raw : null;
        if (!v || v.some((x) => !Number.isInteger(x) || x <= 0)) throw new HttpError(400, `Liste invalide : ${name}`);
        listValues[name] = [...new Set(v as number[])];
      }
    }
    return { values, listValues };
  }

  async insert(input: Record<string, unknown>, allowed?: ReadonlySet<string>, server: Record<string, unknown> = {}): Promise<number> {
    const { values, listValues } = this.parse(input, allowed);
    return database().transaction(async (tx) => {
      const [row] = (await tx
        .insert(this.spec.table as never)
        .values({ ...values, ...server } as never)
        .returning({ id: col(this.spec.table, 'id') })) as { id: number }[];
      await this.writeLists(tx, row!.id, listValues);
      return row!.id;
    });
  }

  async update(id: number, input: Record<string, unknown>, allowed?: ReadonlySet<string>, server: Record<string, unknown> = {}): Promise<void> {
    const { values, listValues } = this.parse(input, allowed);
    const set = { ...values, ...server };
    await database().transaction(async (tx) => {
      if (Object.keys(set).length) await tx.update(this.spec.table as never).set(set as never).where(eq(col(this.spec.table, 'id'), id));
      await this.writeLists(tx, id, listValues);
    });
  }

  async remove(id: number): Promise<void> {
    await database().delete(this.spec.table as never).where(eq(col(this.spec.table, 'id'), id));
  }

  private async writeLists(tx: Pick<ReturnType<typeof database>, 'delete' | 'insert'>, id: number, lists: Record<string, number[]>) {
    for (const [name, ids] of Object.entries(lists)) {
      const l = this.spec.lists![name]!;
      await tx.delete(l.table as never).where(eq(col(l.table, l.owner), id));
      if (ids.length) await tx.insert(l.table as never).values(ids.map((o) => ({ [l.owner]: id, [l.other]: o })) as never);
    }
  }
}
