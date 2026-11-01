'use server';

import { requireSession } from '../http';
import { updateRow } from '../tables';
import { declarerMarche, inviterTitulaire, modifierMarche, publierMarche, refuserDeclaration, relancerTitulaire, supprimerMarche, validerDeclaration } from '../services/marches-acheteur';
import { attempt, type ActionResult } from './result';

/**
 * Actions de l'espace acheteur. Chacune relit la session (une action est joignable par un POST direct),
 * puis délègue à un service qui contrôle le rôle et la propriété du marché.
 */

export const declarer = async (input: unknown): Promise<ActionResult<{ id: number }>> => attempt(async () => declarerMarche(await requireSession(), input));
export const modifier = async (marcheId: number, input: unknown): Promise<ActionResult<null>> => attempt(async () => (await modifierMarche(await requireSession(), marcheId, input), null));
export const supprimer = async (marcheId: number): Promise<ActionResult<null>> => attempt(async () => (await supprimerMarche(await requireSession(), marcheId), null));
export const publier = async (marcheId: number, input: unknown): Promise<ActionResult<null>> => attempt(async () => (await publierMarche(await requireSession(), marcheId, input), null));
export const inviter = async (marcheId: number, input: unknown): Promise<ActionResult<null>> => attempt(async () => (await inviterTitulaire(await requireSession(), marcheId, input), null));
export const relancer = async (marcheId: number): Promise<ActionResult<null>> => attempt(async () => (await relancerTitulaire(await requireSession(), marcheId), null));
export const valider = async (marcheId: number): Promise<ActionResult<null>> => attempt(async () => (await validerDeclaration(await requireSession(), marcheId), null));
export const refuser = async (marcheId: number, input: unknown): Promise<ActionResult<null>> => attempt(async () => (await refuserDeclaration(await requireSession(), marcheId, input), null));

/** Enregistre la fiche de l'entité de l'acheteur connecté (l'entité vient de la session, jamais de la page). */
export async function enregistrerEntite(fields: Record<string, unknown>): Promise<ActionResult<null>> {
  return attempt(async () => {
    const session = await requireSession();
    if (!session.roles.includes('acheteur') || !session.acheteurEntiteId) throw Object.assign(new Error('Accès refusé.'), { status: 403 });
    await updateRow(session, 'Acheteurs', session.acheteurEntiteId, fields);
    return null;
  });
}
