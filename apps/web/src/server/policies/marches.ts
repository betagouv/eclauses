import { eq } from 'drizzle-orm';
import { marches as marchesTable } from '../compat/marches';
import { utilisateurParEmail } from '../services/comptes';
import { marcheModifie } from '../services/notifications';
import type { Row } from '../compat/engine';
import { database } from '../db/client';
import { marches as marchesDb } from '../db/schema';
import { HttpError } from '../http';
import { assertOwnMarche, forbidden, isInvolved, marcheById, num, pick, requireActor, requireRole, wanted } from './common';
import type { Actor, TablePolicy } from './types';

/** Colonnes lisibles par un non-acheteur (anciennes règles d'accès du document Grist, onglet Marches). */
const PUBLIC_COLUMNS = [
  'Date_de_notification_previsionnelle',
  'Latitude',
  'Longitude',
  'Date_Limite_de_Remise_des_Offres',
  'Date_de_publication',
  'Intitule_du_marche',
  'Acheteur',
  'Numero_de_lot',
  'Lieu_d_execution',
  'Date_de_fin_d_execution',
  'Clauses_sociales',
  'Invitation_Titulaire_Marche',
  'Lien_vers_les_documents_de_consultation',
  'Specialites_du_marche',
  'Intitule_du_lot',
  'Marche_parent',
  'Marche_parent_Intitule_propre',
  'Intitule_propre',
  // Structure parent/lots : nécessaire à l'affichage, sans donnée sensible.
  'Est_lot',
  'Est_marche_parent',
  'Lot_Label',
  'Intitule_Lot',
  'Lots',
  'Nb_lots',
  'Marche_racine',
  'Lien_Inscription_Candidat',
] as const;

const PUBLISHED = 'En attente de notification';
/** Statuts que les bénéficiaires ne voient pas : marché pas encore publié, ou clause déjà validée. */
const HIDDEN_FROM_BENEFICIAIRES = new Set(['En attente de publication', 'Clause validée']);

/**
 * Colonnes du marché visibles pour l'acteur ; `null` si le marché est entièrement caché.
 * - acheteur de l'entité : tout ;
 * - bénéficiaire : colonnes publiques, sauf marchés non publiés ou déjà validés ;
 * - titulaire ou candidat du marché : colonnes publiques et statut ;
 * - tout le monde, visiteurs compris : colonnes publiques d'un marché publié.
 */
export function visibleColumns(actor: Actor, row: Row): readonly string[] | 'all' | null {
  if (actor?.acheteurEntiteId && actor.roles.includes('acheteur') && num(row.Acheteur) === actor.acheteurEntiteId) {
    return 'all';
  }
  const involved = !!actor && actor.roles.includes('repondant') && isInvolved(row, actor);
  const benefOk = !!actor && actor.roles.includes('beneficiaire') && !HIDDEN_FROM_BENEFICIAIRES.has(String(row.Statut));
  if (!involved && !benefOk && row.Statut !== PUBLISHED) return null;
  return [...PUBLIC_COLUMNS, ...(actor ? ['Acheteur_Nom'] : []), ...(involved ? ['Statut'] : [])];
}

/** Champs que l'acheteur ne saisit jamais : posés par le serveur à la création. */
const SERVER_SET = new Set(['Acheteur', 'Creation_en_autonomie', 'Cree_par']);

const stripServerSet = (fields: Record<string, unknown>) => Object.fromEntries(Object.entries(fields).filter(([k]) => !SERVER_SET.has(k)));

export const marches: TablePolicy = {
  async read(actor, { ids }) {
    const out: Row[] = [];
    for (const row of await marchesTable.read({ ids })) {
      if (!wanted(ids, row)) continue;
      const cols = visibleColumns(actor, row);
      if (!cols) continue;
      out.push(cols === 'all' ? row : pick(row, cols));
    }
    return out;
  },

  async create(actor, fields) {
    const s = requireRole(actor, 'acheteur');
    if (!s.acheteurEntiteId) throw forbidden();
    const user = await utilisateurParEmail(s.email);
    // Le marché est créé depuis le front par l'acheteur : l'entité et l'indicateur de statistiques sont posés ici.
    const id = await marchesTable.insert(stripServerSet(fields), undefined, {
      acheteurId: s.acheteurEntiteId,
      creationEnAutonomie: true,
      creeParUtilisateurId: user?.id ?? null,
    });
    await marcheModifie(id);
    return id;
  },

  async update(actor, id, fields) {
    const s = requireActor(actor);
    const marche = await marcheById(id);
    if (!marche) throw new HttpError(404, 'Marché introuvable.');

    if (s.roles.includes('acheteur') && s.acheteurEntiteId && num(marche.Acheteur) === s.acheteurEntiteId) {
      await marchesTable.update(id, stripServerSet(fields), undefined, { modifieLe: new Date() });
      await marcheModifie(id);
      return;
    }

    // Un répondant impliqué ne peut que soumettre sa déclaration à la validation de l'acheteur.
    if (s.roles.includes('repondant') && isInvolved(marche, s)) {
      const keys = Object.keys(fields);
      if (keys.length === 1 && keys[0] === 'Statut' && fields.Statut === 'Déclaration à valider') {
        await marchesTable.update(id, { Statut: 'Déclaration à valider' }, undefined, { modifieLe: new Date() });
        await marcheModifie(id);
        return;
      }
    }
    throw forbidden();
  },

  async remove(actor, id) {
    const s = requireRole(actor, 'acheteur');
    await assertOwnMarche(s, id);
    try {
      await database().delete(marchesDb).where(eq(marchesDb.id, id));
    } catch (e) {
      // Un marché parent ne se supprime pas tant qu'il a des lots.
      if ((e as { cause?: { code?: string } }).cause?.code === '23503') throw new HttpError(409, 'Supprimez d’abord les lots de ce marché.');
      throw e;
    }
  },
};
