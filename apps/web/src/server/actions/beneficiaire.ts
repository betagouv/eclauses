'use server';

import type { Row } from '../compat/engine';
import { updateOwnProfile } from '../beneficiaires';
import { requireSession } from '../http';
import { createRow, readTable, removeRow } from '../tables';
import { attempt, type ActionResult } from './result';

/**
 * Écritures des pages bénéficiaire. Une Server Action est joignable par un POST direct : la session est
 * relue ici, et les mêmes politiques d'accès qu'ailleurs s'appliquent (jamais de confiance dans la page).
 */

const interets = async () => readTable(await requireSession(), 'Marches_Interets');

export async function ajouterInteret(marcheId: number): Promise<ActionResult<Row[]>> {
  return attempt(async () => {
    const session = await requireSession();
    if (!Number.isInteger(marcheId) || marcheId <= 0) throw Object.assign(new Error('Marché invalide.'), { status: 400 });
    await createRow(session, 'Marches_Interets', { Marche: marcheId });
    return interets();
  });
}

export async function retirerInteret(id: number): Promise<ActionResult<Row[]>> {
  return attempt(async () => {
    const session = await requireSession();
    if (!Number.isInteger(id) || id <= 0) throw Object.assign(new Error('Intérêt invalide.'), { status: 400 });
    await removeRow(session, 'Marches_Interets', id);
    return interets();
  });
}

/** Enregistre la fiche du bénéficiaire connecté et renvoie la fiche à jour. */
export async function enregistrerProfil(fields: Record<string, unknown>): Promise<ActionResult<Row | null>> {
  return attempt(async () => {
    const session = await requireSession();
    if (!session.beneficiaireId) throw Object.assign(new Error('Accès refusé.'), { status: 403 });
    await updateOwnProfile(session, session.beneficiaireId, fields);
    return (await readTable(session, 'Beneficiaires', [session.beneficiaireId]))[0] ?? null;
  });
}

/** Relit la fiche du bénéficiaire connecté (après un dépôt ou un retrait de CV, par exemple). */
export async function lireProfil(): Promise<ActionResult<Row | null>> {
  return attempt(async () => {
    const session = await requireSession();
    if (!session.beneficiaireId) return null;
    return (await readTable(session, 'Beneficiaires', [session.beneficiaireId]))[0] ?? null;
  });
}
