import type { Row } from './compat/engine';
import type { Actor } from './policies/types';
import { readTable } from './tables';

/**
 * Données d'une page lues par le serveur au moment du rendu, sans passer par HTTP : mêmes politiques
 * d'accès que `/api/data`, en parallèle. Une table facultative interdite ou en erreur donne une liste
 * vide (comme les `.catch(() => [])` des anciennes pages) ; une table obligatoire fait échouer la page.
 */
export async function loadTables(actor: Actor, required: string[], optional: string[] = []): Promise<Record<string, Row[]>> {
  const entries = await Promise.all([
    ...required.map(async (t) => [t, await readTable(actor, t)] as const),
    ...optional.map(async (t) => [t, await readTable(actor, t).catch(() => [] as Row[])] as const),
  ]);
  return Object.fromEntries(entries);
}
