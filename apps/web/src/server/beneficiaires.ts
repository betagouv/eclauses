import { z } from 'zod';
import { grist } from './config';
import type { Row } from './grist/client';
import type { Session } from './auth/session';
import { HttpError } from './http';

export const CONSENT_ANNUAIRE = 'Je_consens_a_figurer_dans_l_annuaire_partage_avec_les_professionnels_du_secteur';
export const CONSENT_CONTACT = 'Je_consens_a_etre_contacte_pour_rejoindre_des_groupements';
export const CV_COLUMN = 'curriculum_vitae';

/** Coordonnées masquées tant que la personne n'a pas accepté d'être contactée. */
const CONTACT_FIELDS = ['Courriel', 'Telephone'] as const;

/** Colonnes internes (administration) : jamais renvoyées au navigateur, même pour sa propre fiche. */
export const INTERNAL_COLUMNS = ['Clef_secrete', 'Commentaire', 'Missions_proposees'] as const;

const truthy = (v: unknown) => v === true || v === 1 || v === '1';

export function stripInternal(row: Row): Row {
  const copy: Row = { ...row };
  for (const c of INTERNAL_COLUMNS) delete copy[c];
  return copy;
}

export const isVisibleToOthers = (row: Row) =>
  truthy(row[CONSENT_ANNUAIRE]) && truthy(row.Eligible) && !truthy(row.Doit_supprimer);

export function redact(row: Row): Row {
  if (truthy(row[CONSENT_CONTACT])) return row;
  const copy: Row = { ...row };
  for (const f of CONTACT_FIELDS) delete copy[f];
  return copy;
}

/**
 * Lecture de `Beneficiaires`. Remplace les règles d'accès (ACL) du document :
 * - sa propre fiche, en entier ;
 * - les fiches des personnes qui consentent à figurer dans l'annuaire, avec les coordonnées masquées
 *   sauf consentement au contact. `ids` restreint la lecture (équivalent d'un `getData` ciblé).
 */
export async function readBeneficiaires(session: Session, ids?: number[]): Promise<Row[]> {
  const g = grist();
  const own = session.beneficiaireId;
  const out: Row[] = [];

  if (own && (!ids || ids.includes(own))) {
    out.push(...(await g.records('Beneficiaires', { filter: { id: [own] } })).map(stripInternal));
  }

  const others = await g.records('Beneficiaires', {
    filter: { [CONSENT_ANNUAIRE]: [true], ...(ids ? { id: ids } : {}) },
  });
  for (const row of others) {
    if (row.id !== own && isVisibleToOthers(row)) out.push(redact(stripInternal(row)));
  }
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

const LIST_FIELDS = ['Specialite', 'Departement_de_residence', 'Regions_ou_vous_etes_mobile'] as const;

export async function updateOwnProfile(session: Session, id: number, input: unknown): Promise<void> {
  if (session.beneficiaireId !== id) throw new HttpError(403, 'Cette fiche ne vous appartient pas.');

  const parsed = profileUpdate.safeParse(input);
  if (!parsed.success) throw new HttpError(400, 'Données invalides.', parsed.error.flatten());
  const fields: Record<string, unknown> = { ...parsed.data };

  // L'adresse e-mail identifie la personne : elle ne se change pas depuis le profil.
  if ('Courriel' in fields) {
    const [current] = await grist().records('Beneficiaires', { filter: { id: [id] } });
    if (String(fields.Courriel).trim().toLowerCase() !== String(current?.Courriel ?? '').trim().toLowerCase()) {
      throw new HttpError(400, "L'adresse e-mail ne peut pas être modifiée depuis le profil.");
    }
    delete fields.Courriel;
  }

  for (const f of LIST_FIELDS) {
    const v = fields[f] as number[] | null | undefined;
    if (Array.isArray(v)) fields[f] = ['L', ...v];
  }
  if ('Fiche_MAJ' in fields) fields.Fiche_MAJ = fields.Fiche_MAJ === true || fields.Fiche_MAJ === 1;

  await grist().updateRecords('Beneficiaires', [{ id, fields }]);
}

export async function setOwnCv(session: Session, id: number, attachmentId: number | null): Promise<void> {
  if (session.beneficiaireId !== id) throw new HttpError(403, 'Cette fiche ne vous appartient pas.');
  await grist().updateRecords('Beneficiaires', [
    { id, fields: { [CV_COLUMN]: attachmentId ? ['L', attachmentId] : ['L'] } },
  ]);
}

/** Droit de lire un CV : le sien, ou celui d'une personne visible dans l'annuaire. */
export async function canReadAttachment(session: Session, attachmentId: number): Promise<boolean> {
  const rows = await grist().sql<{ id: number } & Record<string, unknown>>(
    `SELECT b.id, b.${CONSENT_ANNUAIRE} AS annuaire, b.Eligible AS eligible, b.Doit_supprimer AS suppr
       FROM Beneficiaires b
      WHERE json_valid(b.${CV_COLUMN})
        AND EXISTS (SELECT 1 FROM json_each(b.${CV_COLUMN}) WHERE value = ?1)`,
    [attachmentId],
  );
  return rows.some(
    (r) =>
      r.id === session.beneficiaireId ||
      (truthy(r.annuaire) && truthy(r.eligible) && !truthy(r.suppr)),
  );
}
