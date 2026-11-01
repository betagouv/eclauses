/**
 * Génère les types TypeScript du schéma Grist (colonne par colonne) dans
 * `src/server/grist/schema.generated.ts`. À relancer quand le document change :
 *   npm run gen:schema -w apps/web
 */
import { writeFileSync } from 'node:fs';
import { GristClient } from '../src/server/grist/client';

process.loadEnvFile?.('.env.local');

const client = new GristClient({
  baseUrl: process.env.GRIST_BASE_URL ?? 'https://grist.numerique.gouv.fr',
  docId: process.env.GRIST_DOC_ID ?? '',
  apiKey: process.env.GRIST_API_KEY ?? '',
});

const LIST = (inner: string) => `['L', ...${inner}[]] | null`;

function tsType(gristType: string): string {
  if (gristType.startsWith('Ref:')) return 'number';
  if (gristType.startsWith('RefList:')) return LIST('number');
  if (gristType.startsWith('DateTime')) return 'number | null';
  if (gristType.startsWith('Date')) return 'number | null';
  switch (gristType) {
    case 'Text':
    case 'Choice':
      return 'string';
    case 'Numeric':
    case 'Int':
    case 'Id':
      return 'number';
    case 'Bool':
      return 'boolean';
    case 'ChoiceList':
      return LIST('string');
    case 'Attachments':
      return LIST('number');
    default:
      return 'unknown';
  }
}

const tables = (await client.tables()).filter((t) => !t.includes('_summary_') && !t.startsWith('_grist'));
let out = `// Fichier généré par scripts/gen-schema.ts : ne pas modifier à la main.\n// Document : ${process.env.GRIST_DOC_ID}\n\n`;
const names: string[] = [];

for (const table of tables) {
  const cols = await client.columns(table);
  out += `export interface ${table} {\n  id: number;\n`;
  for (const c of cols) {
    const doc = c.isFormula ? ' /** formule */' : '';
    out += `  ${/^[A-Za-z_]\w*$/.test(c.id) ? c.id : JSON.stringify(c.id)}: ${tsType(c.type)};${doc}\n`;
  }
  out += `}\n\n`;
  names.push(table);
}

out += `export interface Schema {\n${names.map((n) => `  ${n}: ${n};`).join('\n')}\n}\n\nexport type TableName = keyof Schema;\n`;
writeFileSync(new URL('../src/server/grist/schema.generated.ts', import.meta.url), out);
console.log(`${names.length} tables générées`);
