// Applique les migrations SQL de ./drizzle sur la base désignée par DATABASE_URL.
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDatabase } from '../src/server/db/client';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL manquant');
  process.exit(1);
}
const { db, sql } = createDatabase(url, { max: 1 });
try {
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('Migrations appliquées.');
} finally {
  await sql.end();
}
