import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { database } from '../db/client';
import { candidatures, marches, repondants } from '../db/schema';
import { HttpError } from '../http';
import { createRow } from '../tables';
import { utilisateurParEmail } from './comptes';

/**
 * Inscription d'un candidat à une consultation. Les deux étapes de la page (« cette adresse est-elle déjà connue ? »
 * puis la création du compte) passent ici, avec les mêmes contrôles côté serveur que ceux de la page.
 */

const ids = z.array(z.number().int().positive()).min(1, 'Sélectionnez au moins un lot.').max(200);
const email = z.string().trim().toLowerCase().email('Adresse e-mail invalide.').max(320);

/** Marchés réellement ouverts aux candidatures parmi ceux demandés (publiés, statut « en attente de notification »). */
async function ouverts(marcheIds: number[]): Promise<number[]> {
  const rows = await database().select({ id: marches.id }).from(marches).where(and(inArray(marches.id, marcheIds), eq(marches.statut, 'en_attente_notification')));
  return rows.map((r) => r.id);
}

/** `exist` : l'adresse a déjà un espace, les marchés choisis sont ajoutés à ses candidatures ; `new` : il faut créer le compte. */
export async function verifierCandidat(input: { email: string; marcheIds: number[] }): Promise<'new' | 'exist'> {
  const parsed = z.object({ email, marcheIds: ids }).safeParse(input);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Requête invalide.');
  const user = await utilisateurParEmail(parsed.data.email);
  const db = database();
  const [existing] = user ? await db.select({ id: repondants.id }).from(repondants).where(eq(repondants.utilisateurId, user.id)) : [];
  if (!existing) return 'new';
  const published = await ouverts(parsed.data.marcheIds);
  if (published.length) await db.insert(candidatures).values(published.map((marcheId) => ({ marcheId, repondantId: existing.id }))).onConflictDoNothing();
  return 'exist';
}

const inscription = z.object({
  email,
  nom: z.string().trim().min(1, 'Champ requis.').max(200),
  prenom: z.string().trim().min(1, 'Champ requis.').max(200),
  raisonSociale: z.string().trim().min(1, 'Champ requis.').max(300),
  siret: z.string().trim().min(1, 'Champ requis.').max(40),
  telephone: z.string().trim().max(40).nullish(),
  marcheIds: ids,
});

/** Crée le répondant (compte sans mot de passe, candidatures, lien d'activation par courrier). */
export async function inscrireCandidat(input: unknown): Promise<void> {
  const parsed = inscription.safeParse(input);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Données invalides.');
  const d = parsed.data;
  // Même chemin que partout ailleurs : mêmes droits, mêmes contrôles (marchés publiés, adresse unique).
  await createRow(null, 'Repondants', { Email: d.email, Nom: d.nom, Prenom: d.prenom, Raison_sociale: d.raisonSociale, Siret: d.siret, Telephone: d.telephone || null, Candidat_aux_marches: d.marcheIds });
}
