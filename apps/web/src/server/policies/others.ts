import type { Row } from '../grist/client';
import { grist } from '../config';
import { decodeRows, prepareFields } from '../grist/schema';
import { HttpError } from '../http';
import {
  assertOwnMarche,
  forbidden,
  isTitulaire,
  listIds,
  marcheById,
  num,
  omit,
  pick,
  requireActor,
  requireRole,
  truthy,
  wanted,
} from './common';
import type { TablePolicy } from './types';

const byIds = async (table: string, ids?: number[]): Promise<Row[]> =>
  decodeRows(table, await grist().records(table, ids ? { filter: { id: ids } } : {}));

/* ---------------------------------------------------------------- Lecture seule ---------- */

const readOnlyTable = (table: string, opts: { authed?: boolean; filter?: (r: Row) => boolean; shape?: (r: Row) => Row }): TablePolicy => ({
  async read(actor, { ids }) {
    if (opts.authed) requireActor(actor);
    const rows = await byIds(table, ids);
    const kept = opts.filter ? rows.filter(opts.filter) : rows;
    return opts.shape ? kept.map(opts.shape) : kept;
  },
});

export const referentiel = (table: string) => readOnlyTable(table, { authed: true });
export const clauses = readOnlyTable('Clauses_sociales', { authed: true });
export const faqCategories = readOnlyTable('Application_FAQ_Categories', { filter: (r) => truthy(r.Published) });
export const faqQuestions = readOnlyTable('Application_FAQ_Questions', { filter: (r) => truthy(r.Published) });
export const supportVideos = readOnlyTable('Support_Videos', { filter: (r) => truthy(r.Published) });
export const impacts = readOnlyTable('Impacts', {
  shape: (r) => pick(r, ['Description', 'Label', 'Ordre', 'Valeur', 'ColSpan', 'Type_d_indicateur']),
});

/* ---------------------------------------------------------------- Acheteurs -------------- */

export const acheteurs: TablePolicy = {
  async read(actor, { ids }) {
    requireActor(actor);
    return (await byIds('Acheteurs', ids)).map((r) => pick(r, ['Nom']));
  },
  async update(actor, id, fields) {
    const s = requireRole(actor, 'acheteur');
    if (s.acheteurEntiteId !== id) throw forbidden();
    const clean = await prepareFields('Acheteurs', fields, new Set(['Nom']));
    await grist().updateRecords('Acheteurs', [{ id, fields: clean }]);
  },
};

export const utilisateursAcheteurs: TablePolicy = {
  async read(actor, { ids }) {
    const s = requireRole(actor, 'acheteur');
    return (await byIds('Utilisateurs_Acheteurs', ids)).filter((r) => r.id === s.acheteurId);
  },
  async update(actor, id, fields) {
    const s = requireRole(actor, 'acheteur');
    if (s.acheteurId !== id) throw forbidden();
    const clean = await prepareFields('Utilisateurs_Acheteurs', fields, new Set(['Nom', 'Prenom']));
    await grist().updateRecords('Utilisateurs_Acheteurs', [{ id, fields: clean }]);
  },
};

/* ---------------------------------------------------------------- Répondants ------------- */

const REPONDANT_EDITABLE = new Set(['Nom', 'Prenom', 'Email', 'Telephone', 'Raison_sociale', 'Siret']);
const REPONDANT_CREATABLE = new Set([...REPONDANT_EDITABLE, 'Candidat_aux_marches']);

export const repondants: TablePolicy = {
  async read(actor, { ids }) {
    const s = requireRole(actor, 'repondant');
    return (await byIds('Repondants', ids)).filter((r) => r.id === s.repondantId);
  },
  /** Inscription d'un candidat : ouverte aux visiteurs, limitée aux champs de l'inscription. */
  async create(_actor, fields) {
    const clean = await prepareFields('Repondants', fields, REPONDANT_CREATABLE);
    if (!String(clean.Email ?? '').includes('@')) throw new HttpError(400, 'Adresse e-mail invalide.');
    // Un candidat ne peut s'inscrire que sur des marchés publiés.
    const wanted = listIds(clean.Candidat_aux_marches);
    if (wanted.length) {
      const published = await grist().records('Marches', { filter: { id: wanted, Statut: ['En attente de notification'] } });
      if (published.length !== new Set(wanted).size) throw new HttpError(400, "Un des marchés choisis n'est pas ouvert aux candidatures.");
    }
    const [id] = await grist().addRecords('Repondants', [clean]);
    return id!;
  },
  async update(actor, id, fields) {
    const s = requireRole(actor, 'repondant');
    if (s.repondantId !== id) throw forbidden();
    // L'adresse e-mail identifie le compte : elle ne se change pas ici (« contacter le support »).
    const { Email, ...rest } = fields;
    if (Email !== undefined) {
      const [current] = await grist().records('Repondants', { filter: { id: [id] } });
      if (String(Email ?? '').trim().toLowerCase() !== String(current?.Email ?? '').trim().toLowerCase()) {
        throw new HttpError(400, "L'adresse e-mail ne peut pas être modifiée : contactez le support.");
      }
    }
    const clean = await prepareFields('Repondants', rest, REPONDANT_EDITABLE);
    await grist().updateRecords('Repondants', [{ id, fields: clean }]);
  },
};

/* ---------------------------------------------------------------- Invitations ------------ */

export const invitations: TablePolicy = {
  async read(actor, { ids }) {
    const s = requireRole(actor, 'acheteur');
    const own = await ownMarcheIds(s.acheteurEntiteId);
    return (await byIds('Invitation_Titulaire', ids)).filter((r) => own.has(num(r.Marche)));
  },
  async create(actor, fields) {
    const s = requireRole(actor, 'acheteur');
    await assertOwnMarche(s, num(fields.Marche));
    const email = String(fields.Email ?? '').trim();
    if (!email.includes('@')) throw new HttpError(400, 'Adresse e-mail invalide.');
    const clean = await prepareFields('Invitation_Titulaire', { Marche: fields.Marche, Email: email });
    const [id] = await grist().addRecords('Invitation_Titulaire', [clean]);
    return id!;
  },
  async update(actor, id, fields) {
    const s = requireRole(actor, 'acheteur');
    const [inv] = await grist().records('Invitation_Titulaire', { filter: { id: [id] } });
    if (!inv) throw new HttpError(404, 'Invitation introuvable.');
    await assertOwnMarche(s, num(inv.Marche));
    const clean = await prepareFields('Invitation_Titulaire', fields, new Set(['Derniere_relance_le', 'Email']));
    await grist().updateRecords('Invitation_Titulaire', [{ id, fields: clean }]);
  },
};

async function ownMarcheIds(entiteId: number | null): Promise<Set<number>> {
  if (!entiteId) return new Set();
  const rows = await grist().records('Marches', { filter: { Acheteur: [entiteId] } });
  return new Set(rows.map((r) => r.id));
}

/* ---------------------------------------------------------------- Déclarations ----------- */

const DECLARATION_CREATE = new Set(['Marche', 'Est_beneficiaire_eclauses', 'Beneficiaire', 'Nom', 'Prenom', 'Email', 'Statut']);

export const declarations: TablePolicy = {
  async read(actor, { ids }) {
    const s = requireActor(actor);
    const rows = (await byIds('Declarations_Beneficiaires', ids)).filter((r) => wanted(ids, r));
    if (s.roles.includes('acheteur') && s.acheteurEntiteId) {
      const own = await ownMarcheIds(s.acheteurEntiteId);
      return rows.filter((r) => own.has(num(r.Marche)));
    }
    if (s.roles.includes('repondant')) return rows.filter((r) => num(r.Repondant) === s.repondantId);
    return [];
  },
  async create(actor, fields) {
    const s = requireRole(actor, 'repondant');
    const marche = await marcheById(num(fields.Marche));
    if (!marche || !isTitulaire(marche, s)) throw forbidden('Vous n’êtes pas titulaire de ce marché.');
    const clean = await prepareFields('Declarations_Beneficiaires', fields, DECLARATION_CREATE);
    const [id] = await grist().addRecords('Declarations_Beneficiaires', [{ ...clean, Repondant: s.repondantId }]);
    return id!;
  },
  async update(actor, id, fields) {
    const s = requireActor(actor);
    const [decl] = await grist().records('Declarations_Beneficiaires', { filter: { id: [id] } });
    if (!decl) throw new HttpError(404, 'Déclaration introuvable.');
    if (s.roles.includes('acheteur') && s.acheteurEntiteId) {
      await assertOwnMarche(s, num(decl.Marche));
      const clean = await prepareFields('Declarations_Beneficiaires', fields, new Set(['Statut']));
      await grist().updateRecords('Declarations_Beneficiaires', [{ id, fields: clean }]);
      return;
    }
    if (s.roles.includes('repondant') && num(decl.Repondant) === s.repondantId) {
      const clean = await prepareFields('Declarations_Beneficiaires', fields, new Set(['Statut']));
      await grist().updateRecords('Declarations_Beneficiaires', [{ id, fields: clean }]);
      return;
    }
    throw forbidden();
  },
  async remove(actor, id) {
    const s = requireRole(actor, 'repondant');
    const [decl] = await grist().records('Declarations_Beneficiaires', { filter: { id: [id] } });
    if (!decl || num(decl.Repondant) !== s.repondantId) throw forbidden();
    await grist().deleteRecords('Declarations_Beneficiaires', [id]);
  },
};

export const refus: TablePolicy = {
  async read(actor, { ids }) {
    const s = requireActor(actor);
    const rows = await byIds('Declarations_Beneficiaires_Refus', ids);
    if (s.roles.includes('acheteur') && s.acheteurEntiteId) {
      const own = await ownMarcheIds(s.acheteurEntiteId);
      return rows.filter((r) => own.has(num(r.Marche)));
    }
    if (s.roles.includes('repondant') && s.repondantId) {
      return rows.filter((r) => num(r.Marche_Titulaire) === s.repondantId);
    }
    return [];
  },
  async create(actor, fields) {
    const s = requireRole(actor, 'acheteur');
    await assertOwnMarche(s, num(fields.Marche));
    const clean = await prepareFields('Declarations_Beneficiaires_Refus', fields, new Set(['Marche', 'Refuse_le', 'Raison', 'Refuse_par']));
    if (!String(clean.Raison ?? '').trim()) throw new HttpError(400, 'Le motif du refus est obligatoire.');
    const [id] = await grist().addRecords('Declarations_Beneficiaires_Refus', [clean]);
    return id!;
  },
};

/* ---------------------------------------------------------------- Intérêts, coordonnées -- */

export const interets: TablePolicy = {
  async read(actor, { ids }) {
    const s = requireActor(actor);
    const rows = await byIds('Marches_Interets', ids);
    if (s.roles.includes('beneficiaire') && s.beneficiaireId) {
      const mine = rows.filter((r) => num(r.Beneficiaire) === s.beneficiaireId);
      if (mine.length || !s.roles.includes('repondant')) return mine;
    }
    if (s.roles.includes('repondant') && s.repondantId) {
      return rows.filter(
        (r) => num(r.Marche_Titulaire) === s.repondantId || listIds(r.Marche_Candidats).includes(s.repondantId!),
      );
    }
    return [];
  },
  async create(actor, fields) {
    const s = requireRole(actor, 'beneficiaire');
    const clean = await prepareFields('Marches_Interets', { Marche: fields.Marche });
    const [id] = await grist().addRecords('Marches_Interets', [{ ...clean, Beneficiaire: s.beneficiaireId }]);
    return id!;
  },
  async remove(actor, id) {
    const s = requireRole(actor, 'beneficiaire');
    const [row] = await grist().records('Marches_Interets', { filter: { id: [id] } });
    if (!row || num(row.Beneficiaire) !== s.beneficiaireId) throw forbidden();
    await grist().deleteRecords('Marches_Interets', [id]);
  },
};

export const accesCoordonnees: TablePolicy = {
  async read(actor, { ids }) {
    const s = requireActor(actor);
    const rows = await byIds('Acces_Coordonnees', ids);
    if (s.roles.includes('repondant') && s.repondantId) {
      const mine = rows.filter((r) => num(r.Repondant) === s.repondantId);
      if (mine.length) return mine;
    }
    if (s.roles.includes('beneficiaire') && s.beneficiaireId) {
      return rows.filter((r) => num(r.Beneficiaire) === s.beneficiaireId).map((r) => omit(r, ['Repondant']));
    }
    return [];
  },
  async create(actor, fields) {
    const s = requireRole(actor, 'repondant');
    const clean = await prepareFields('Acces_Coordonnees', fields, new Set(['Marche', 'Beneficiaire', 'Affiche_email', 'Affiche_telephone']));
    const [id] = await grist().addRecords('Acces_Coordonnees', [{ ...clean, Repondant: s.repondantId }]);
    return id!;
  },
};

/* ---------------------------------------------------------------- Mot de passe oublié ---- */

export const passwordReset: TablePolicy = {
  /** Demande publique : seule l'adresse e-mail est acceptée (le lien est calculé par Grist). */
  async create(_actor, fields) {
    const email = String(fields.Email ?? '').trim().toLowerCase();
    if (!email.includes('@') || email.length > 320) throw new HttpError(400, 'Adresse e-mail invalide.');
    const clean = await prepareFields('Application_Password_Reset', { Email: email, Is_Reset: true });
    const [id] = await grist().addRecords('Application_Password_Reset', [clean]);
    return id!;
  },
};

