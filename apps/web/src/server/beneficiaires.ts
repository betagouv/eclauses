import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Row } from './compat/engine';
import { CONSENT_ANNUAIRE, CONSENT_CONTACT, beneficiaires as table } from './compat/specs';
import { database } from './db/client';
import { beneficiaires as beneficiairesDb } from './db/schema';
import type { Session } from './auth/session';
import { HttpError } from './http';
import { supprimerFichier } from './services/fichiers';

export { CONSENT_ANNUAIRE, CONSENT_CONTACT };

/** Coordonnées masquées tant que la personne n'a pas accepté d'être contactée. */
const CONTACT_FIELDS = ['Courriel', 'Telephone'] as const;

/** Colonnes internes (administration) : jamais renvoyées au navigateur, même pour sa propre fiche. */
export const INTERNAL_COLUMNS = ['Commentaire', 'Missions_proposees'] as const;

const truthy = (v: unknown) => v === true || v === 1 || v === '1';

export function stripInternal(row: Row): Row {
  const copy: Row = { ...row };
  for (const c of INTERNAL_COLUMNS) delete copy[c];
  return copy;
}

export const isVisibleToOthers = (row: Row) => truthy(row[CONSENT_ANNUAIRE]) && truthy(row.Eligible) && !truthy(row.Doit_supprimer);

export function redact(row: Row): Row {
  if (truthy(row[CONSENT_CONTACT])) return row;
  const copy: Row = { ...row };
  for (const f of CONTACT_FIELDS) delete copy[f];
  return copy;
}

const withoutContacts = (row: Row): Row => {
  const copy: Row = { ...row };
  for (const f of CONTACT_FIELDS) delete copy[f];
  return copy;
};

/**
 * Lecture des bénéficiaires :
 * - sa propre fiche, en entier ;
 * - les fiches des personnes qui consentent à figurer dans l'annuaire, avec les coordonnées masquées
 *   sauf consentement au contact. `ids` restreint la lecture.
 */
export async function readBeneficiaires(session: Session, ids?: number[]): Promise<Row[]> {
  // Un répondant n'obtient jamais les coordonnées en bloc : elles se consultent une par une, pour un marché, et la
  // personne en est prévenue (`services/repondant.consulterCoordonnees`). Les acheteurs et bénéficiaires gardent l'annuaire.
  const noBulkContacts = session.roles.includes('repondant') && !session.roles.includes('beneficiaire') && !session.roles.includes('acheteur');
  const own = session.beneficiaireId;
  const out: Row[] = [];
  if (own && (!ids || ids.includes(own))) {
    const row = await table.byId(own);
    if (row) out.push(stripInternal(row));
  }
  const others = await table.read({ where: and(eq(beneficiairesDb.consentementAnnuaire, true), ...(own ? [sql`${beneficiairesDb.id} <> ${own}`] : [])), ids });
  for (const row of others) if (isVisibleToOthers(row)) out.push(noBulkContacts ? withoutContacts(stripInternal(row)) : redact(stripInternal(row)));
  return out;
}

const idList = z.array(z.number().int().positive()).nullable();
const text = z.string().max(5000).nullable();

/** Champs modifiables par le bénéficiaire sur sa propre fiche. */
const profileUpdate = z
  .object({
    NOM: z.string().min(1).max(200),
    Prenom: z.string().min(1).max(200),
    Courriel: z.string().max(320),
    Telephone: text,
    Specialite_ecole: text,
    Autre_Formation: text,
    Sous_specialite: text,
    Intitule_du_memoire: text,
    Autres_informations: text,
    [CONSENT_ANNUAIRE]: z.boolean(),
    [CONSENT_CONTACT]: z.boolean(),
    Annee_de_diplome: z.union([z.string().max(10), z.number()]).nullable(),
    Formation: z.number().int().positive().nullable(),
    Specialite: idList,
    Departement_de_residence: idList,
    Regions_ou_vous_etes_mobile: idList,
    Fiche_MAJ: z.union([z.boolean(), z.literal(1), z.literal(0)]),
  })
  .partial()
  .strict();

export async function updateOwnProfile(session: Session, id: number, input: unknown): Promise<void> {
  if (session.beneficiaireId !== id) throw new HttpError(403, 'Cette fiche ne vous appartient pas.');
  const parsed = profileUpdate.safeParse(input);
  if (!parsed.success) throw new HttpError(400, 'Données invalides.', parsed.error.flatten());
  const fields: Record<string, unknown> = { ...parsed.data };

  // L'adresse e-mail identifie la personne : elle ne se change pas depuis le profil.
  if ('Courriel' in fields) {
    if (String(fields.Courriel).trim().toLowerCase() !== session.email) {
      throw new HttpError(400, "L'adresse e-mail ne peut pas être modifiée depuis le profil.");
    }
    delete fields.Courriel;
  }
  await table.update(id, fields, undefined, { modifieLe: new Date() });
}

/** Associe (ou retire) le CV de la fiche ; l'ancien fichier est supprimé du stockage. */
export async function setOwnCv(session: Session, id: number, fichierId: string | null): Promise<void> {
  if (session.beneficiaireId !== id) throw new HttpError(403, 'Cette fiche ne vous appartient pas.');
  const db = database();
  const [before] = await db.select({ cv: beneficiairesDb.cvFichierId }).from(beneficiairesDb).where(eq(beneficiairesDb.id, id));
  await db.update(beneficiairesDb).set({ cvFichierId: fichierId, modifieLe: new Date() }).where(eq(beneficiairesDb.id, id));
  if (before?.cv && before.cv !== fichierId) await supprimerFichier(before.cv);
}

/** Droit de lire un CV : le sien, ou celui d'une personne visible dans l'annuaire. */
export async function canReadCv(session: Session, fichierId: string): Promise<boolean> {
  const [owner] = await database()
    .select({ id: beneficiairesDb.id })
    .from(beneficiairesDb)
    .where(eq(beneficiairesDb.cvFichierId, fichierId));
  if (!owner) return false;
  if (owner.id === session.beneficiaireId) return true;
  const row = await table.byId(owner.id);
  return !!row && isVisibleToOthers(row);
}
