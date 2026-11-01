'use server';

import { remove, resourceOrThrow, save } from '../admin/crud';
import { requireAdmin } from '../admin/guard';
import { attempt, type ActionResult } from './result';

/** Écritures génériques de l'administration : le rôle et la double authentification sont revérifiés à chaque appel. */

export async function enregistrer(key: string, id: string | number | null, values: Record<string, unknown>): Promise<ActionResult<{ id: string | number }>> {
  return attempt(async () => {
    const admin = await requireAdmin();
    return save(admin, resourceOrThrow(key), id, values ?? {});
  });
}

export async function supprimer(key: string, id: string | number): Promise<ActionResult<null>> {
  return attempt(async () => {
    const admin = await requireAdmin();
    await remove(admin, resourceOrThrow(key), id);
    return null;
  });
}
