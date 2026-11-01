'use server';

import type { Row } from '../compat/engine';
import { requireSession } from '../http';
import { consulterCoordonnees, declarerBeneficiaires, retirerDeclaration } from '../services/repondant';
import { readTable, updateRow } from '../tables';
import { attempt, type ActionResult } from './result';

/** Actions de l'espace répondant : la session est relue à chaque appel, puis un service contrôle le rôle et le lien avec le marché. */

export const declarer = async (marcheId: number, input: unknown): Promise<ActionResult<null>> => attempt(async () => (await declarerBeneficiaires(await requireSession(), marcheId, input), null));
export const retirer = async (declarationId: number): Promise<ActionResult<null>> => attempt(async () => (await retirerDeclaration(await requireSession(), declarationId), null));
export const coordonnees = async (marcheId: number, beneficiaireId: number): Promise<ActionResult<{ Courriel: string; Telephone: string }>> =>
  attempt(async () => consulterCoordonnees(await requireSession(), marcheId, beneficiaireId));

/** Enregistre la fiche du répondant connecté (l'identifiant vient de la session) et renvoie la fiche à jour. */
export async function enregistrerRepondant(fields: Record<string, unknown>): Promise<ActionResult<Row | null>> {
  return attempt(async () => {
    const session = await requireSession();
    if (!session.roles.includes('repondant') || !session.repondantId) throw Object.assign(new Error('Accès refusé.'), { status: 403 });
    await updateRow(session, 'Repondants', session.repondantId, fields);
    return (await readTable(session, 'Repondants', [session.repondantId]))[0] ?? null;
  });
}
