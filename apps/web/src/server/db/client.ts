import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Database = ReturnType<typeof createDatabase>['db'];

export function createDatabase(url: string, options: { max?: number } = {}) {
  const sql = postgres(url, { max: options.max ?? 10, onnotice: () => {} });
  return { sql, db: drizzle(sql, { schema, casing: 'snake_case' }) };
}

let shared: ReturnType<typeof createDatabase> | undefined;

/** Connexion unique du serveur (réutilisée entre les requêtes, y compris en développement). */
export function database(): Database {
  if (!shared) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('Configuration incomplète : DATABASE_URL');
    const g = globalThis as { __eclausesDb?: ReturnType<typeof createDatabase> };
    shared = g.__eclausesDb ??= createDatabase(url);
  }
  return shared.db;
}
