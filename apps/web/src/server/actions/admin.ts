'use server';

import { remove, resourceOrThrow, save } from '../admin/crud';
import { auditer } from '../admin/audit';
import { declarerMarchePourEntite } from '../services/marches-acheteur';
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

/** Crée un marché (et ses lots) pour l'entité choisie : « création en autonomie » faux, courriers comme pour un acheteur. */
export async function declarerPourEntite(entiteId: number, input: unknown): Promise<ActionResult<{ id: number }>> {
  return attempt(async () => {
    const admin = await requireAdmin();
    const res = await declarerMarchePourEntite(admin, entiteId, input);
    await auditer(admin, 'creation', 'marches', res.id, { entite: entiteId, parAdministration: true });
    return res;
  });
}

/* ------------------------------------------------------------------ Comptes ----------------- */

import { definirAdmin, desactiver, envoyerActivation, envoyerReinitialisation, reinitialiserMfa } from '../admin/comptes';

export async function compteActivation(userId: number): Promise<ActionResult<null>> {
  return attempt(async () => (await envoyerActivation(await requireAdmin(), userId), null));
}
export async function compteReinitialisation(userId: number): Promise<ActionResult<null>> {
  return attempt(async () => (await envoyerReinitialisation(await requireAdmin(), userId), null));
}
export async function compteDesactiver(userId: number): Promise<ActionResult<null>> {
  return attempt(async () => (await desactiver(await requireAdmin(), userId), null));
}
export async function compteAdmin(userId: number, estAdmin: boolean): Promise<ActionResult<null>> {
  return attempt(async () => (await definirAdmin(await requireAdmin(), userId, !!estAdmin), null));
}
export async function compteMfa(userId: number): Promise<ActionResult<null>> {
  return attempt(async () => (await reinitialiserMfa(await requireAdmin(), userId), null));
}
