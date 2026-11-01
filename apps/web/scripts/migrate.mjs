// Applique les migrations au démarrage du conteneur (JavaScript pur : l'image de production n'embarque pas tsx).
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL manquant');
  process.exit(1);
}
const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  await migrate(drizzle(sql), { migrationsFolder: new URL('./drizzle', import.meta.url).pathname });
  console.log('Migrations appliquées.');
} finally {
  await sql.end();
}
