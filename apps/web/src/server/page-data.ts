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

/**
 * Contexte commun des pages acheteur : la ligne de l'utilisateur et celle de son entité, avec le message
 * à afficher si l'un manque (mêmes messages que les anciennes pages).
 */
export async function acheteurBase(actor: NonNullable<Actor>): Promise<{ ua: Row | null; org: Row | null; error: string | null }> {
  if (!actor.roles.includes('acheteur') || !actor.acheteurId) return { ua: null, org: null, error: "Accès refusé : rôle 'acheteur' requis." };
  const t = await loadTables(actor, ['Utilisateurs_Acheteurs', 'Acheteurs']);
  const ua = t.Utilisateurs_Acheteurs.find((r) => r.id === actor.acheteurId) ?? null;
  if (!ua?.Entite_de_rattachement) return { ua, org: null, error: "Votre compte n'est rattaché à aucune entité acheteuse." };
  const org = t.Acheteurs.find((a) => a.id === ua.Entite_de_rattachement) ?? null;
  return { ua, org, error: org ? null : 'Entité acheteuse introuvable.' };
}
