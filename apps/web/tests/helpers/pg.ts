import { randomBytes } from 'node:crypto';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { createDatabase } from '@/server/db/client';

export const hasPostgres = !!process.env.DATABASE_URL;

/**
 * Crée une base jetable (migrations appliquées) à côté de celle de développement, et la supprime à
 * la fin. Les tests d'intégration n'écrivent jamais dans la base de développement elle-même.
 */
export async function temporaryDatabase() {
  const admin = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  const name = `eclauses_test_${randomBytes(6).toString('hex')}`;
  await admin.unsafe(`create database ${name}`);
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = `/${name}`;
  const { db, sql } = createDatabase(url.toString(), { max: 2 });
  await migrate(db, { migrationsFolder: './drizzle' });
  return {
    db,
    sql,
    async drop() {
      await sql.end();
      await admin.unsafe(`drop database ${name} with (force)`);
      await admin.end();
    },
  };
}
