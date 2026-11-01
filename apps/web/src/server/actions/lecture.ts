'use server';

import type { Row } from '../compat/engine';
import { requireSession } from '../http';
import { loadTables } from '../page-data';
import { attempt, type ActionResult } from './result';

/** Relit des tables (après une écriture) avec les mêmes droits qu'au chargement de la page. */
export async function lireTables(names: string[]): Promise<ActionResult<Record<string, Row[]>>> {
  return attempt(async () => {
    const session = await requireSession();
    return loadTables(session, [], names.slice(0, 12));
  });
}
