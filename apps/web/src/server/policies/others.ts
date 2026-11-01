import { and, eq, inArray } from 'drizzle-orm';
import * as others from '../compat/others';
import type { Row } from '../compat/engine';
import { marches } from '../compat/marches';
import * as specs from '../compat/specs';
import { database } from '../db/client';
import { marches as marchesDb, repondants as repondantsDb } from '../db/schema';
import { HttpError } from '../http';
import { assurerUtilisateur, normaliser, utilisateurParEmail } from '../services/comptes';
import {
  accesCoordonneesCree,
  candidatInscrit,
  declarationModifiee,
  invitationCreee,
  motDePasseOublie as demandeMotDePasseOublie,
  refusCree,
} from '../services/notifications';
import { assertOwnMarche, forbidden, isTitulaire, listIds, marcheById, num, omit, pick, requireActor, requireRole, wanted } from './common';
import type { TablePolicy } from './types';

/* ---------------------------------------------------------------- Lecture seule ---------- */

type Readable = { read(opts: { ids?: number[] }): Promise<Row[]> };

const readOnlyTable = (table: Readable, opts: { authed?: boolean; filter?: (r: Row) => boolean; shape?: (r: Row) => Row }): TablePolicy => ({
  async read(actor, { ids }) {
    if (opts.authed) requireActor(actor);
    const rows = await table.read({ ids });
    const kept = opts.filter ? rows.filter(opts.filter) : rows;
    return opts.shape ? kept.map(opts.shape) : kept;
  },
});

const REFERENTIELS: Record<string, Readable> = {
  T0_Referentiel_Formations: specs.formations,
  T0_Referentiel_Specialites: specs.specialites,
  T0_Referentiel_Departements: specs.departements,
  T0_Referentiel_Regions: specs.regions,
  T0_Referentiel_Informations: specs.informations as unknown as Readable,
};

export const referentiel = (name: string) => readOnlyTable(REFERENTIELS[name]!, { authed: true });
/**
 * Les pages n'ont besoin que du libellé et des gabarits d'une clause. Les listes calculées (`Beneficiaires`,
 * `Beneficiaires_Actif` : identifiants et adresses e-mail de tous les bénéficiaires rattachés) ne sortent jamais
 * du serveur : elles incluraient des personnes qui n'ont pas consenti à figurer dans l'annuaire.
 */
export const clauses = readOnlyTable(specs.clauses, {
  authed: true,
  shape: (r) => pick(r, ['Nom_de_la_clause', 'Gabarit_d_article_de_marche', 'html_gabarit_annuaire_clause']),
});
export const faqCategories = readOnlyTable(others.faqCategories, { filter: (r) => r.Published === true });
export const faqQuestions = readOnlyTable(others.faqQuestions, { filter: (r) => r.Published === true });
export const supportVideos = readOnlyTable(others.supportVideos, { filter: (r) => r.Published === true });
export const impacts = readOnlyTable(others.impacts, { shape: (r) => pick(r, ['Description', 'Label', 'Ordre', 'Valeur', 'ColSpan', 'Type_d_indicateur']) });

/* ---------------------------------------------------------------- Acheteurs -------------- */

export const acheteurs: TablePolicy = {
  async read(actor, { ids }) {
    requireActor(actor);
    return (await specs.acheteurs.read({ ids })).map((r) => pick(r, ['Nom']));
  },
  async update(actor, id, fields) {
    const s = requireRole(actor, 'acheteur');
    if (s.acheteurEntiteId !== id) throw forbidden();
    await specs.acheteurs.update(id, fields, new Set(['Nom']));
  },
};

export const utilisateursAcheteurs: TablePolicy = {
  async read(actor, { ids }) {
    const s = requireRole(actor, 'acheteur');
    return (await specs.utilisateursAcheteurs.read({ ids })).filter((r) => r.id === s.acheteurId);
  },
  async update(actor, id, fields) {
    const s = requireRole(actor, 'acheteur');
    if (s.acheteurId !== id) throw forbidden();
    await specs.utilisateursAcheteurs.update(id, fields, new Set(['Nom', 'Prenom']));
  },
};

/* ---------------------------------------------------------------- Répondants ------------- */

const REPONDANT_EDITABLE = new Set(['Nom', 'Prenom', 'Telephone', 'Raison_sociale', 'Siret']);

export const repondants: TablePolicy = {
  async read(actor, { ids }) {
    const s = requireRole(actor, 'repondant');
    return (await specs.repondants.read({ ids })).filter((r) => r.id === s.repondantId);
  },

  /** Inscription d'un candidat : ouverte aux visiteurs, limitée aux champs de l'inscription. */
  async create(_actor, fields) {
    const { Email, ...rest } = fields;
    const email = normaliser(String(Email ?? ''));
    if (!email.includes('@') || email.length > 320) throw new HttpError(400, 'Adresse e-mail invalide.');

    // Un candidat ne peut s'inscrire que sur des marchés publiés.
    const candidatures = listIds(rest.Candidat_aux_marches);
    if (candidatures.length) {
      const published = await database()
        .select({ id: marchesDb.id })
        .from(marchesDb)
        .where(and(inArray(marchesDb.id, candidatures), eq(marchesDb.statut, 'en_attente_notification')));
      if (published.length !== new Set(candidatures).size) throw new HttpError(400, "Un des marchés choisis n'est pas ouvert aux candidatures.");
    }

    const { id: userId } = await assurerUtilisateur(email);
    const [existing] = await database().select({ id: repondantsDb.id }).from(repondantsDb).where(eq(repondantsDb.utilisateurId, userId));
    if (existing) throw new HttpError(409, 'Un compte existe déjà pour cette adresse e-mail.');
    const id = await specs.repondants.insert(rest, new Set([...REPONDANT_EDITABLE, 'Candidat_aux_marches']), { utilisateurId: userId });
    await candidatInscrit(id);
    return id;
  },

  async update(actor, id, fields) {
    const s = requireRole(actor, 'repondant');
    if (s.repondantId !== id) throw forbidden();
    // L'adresse e-mail identifie le compte : elle ne se change pas ici (« contacter le support »).
    const { Email, ...rest } = fields;
    if (Email !== undefined && normaliser(String(Email ?? '')) !== s.email) {
      throw new HttpError(400, "L'adresse e-mail ne peut pas être modifiée : contactez le support.");
    }
    await specs.repondants.update(id, rest, REPONDANT_EDITABLE);
  },
};

/* ---------------------------------------------------------------- Invitations ------------ */

const ownMarcheIds = async (entiteId: number | null): Promise<Set<number>> => {
  if (!entiteId) return new Set();
  const rows = await database().select({ id: marchesDb.id }).from(marchesDb).where(eq(marchesDb.acheteurId, entiteId));
  return new Set(rows.map((r) => r.id));
};

export const invitations: TablePolicy = {
  async read(actor, { ids }) {
    const s = requireRole(actor, 'acheteur');
    const own = await ownMarcheIds(s.acheteurEntiteId);
    return (await others.invitations.read({ ids })).filter((r) => own.has(num(r.Marche)));
  },
  async create(actor, fields) {
    const s = requireRole(actor, 'acheteur');
    await assertOwnMarche(s, num(fields.Marche));
    const email = String(fields.Email ?? '').trim();
    if (!email.includes('@')) throw new HttpError(400, 'Adresse e-mail invalide.');
    const id = await others.invitations.insert({ Marche: fields.Marche, Email: email });
    await invitationCreee(id);
    return id;
  },
  async update(actor, id, fields) {
    const s = requireRole(actor, 'acheteur');
    const inv = await others.invitations.byId(id);
    if (!inv) throw new HttpError(404, 'Invitation introuvable.');
    await assertOwnMarche(s, num(inv.Marche));
    await others.invitations.update(id, fields, new Set(['Derniere_relance_le', 'Email']));
  },
};

/* ---------------------------------------------------------------- Déclarations ----------- */

const DECLARATION_CREATE = new Set(['Marche', 'Est_beneficiaire_eclauses', 'Beneficiaire', 'Nom', 'Prenom', 'Email', 'Statut']);

export const declarations: TablePolicy = {
  async read(actor, { ids }) {
    const s = requireActor(actor);
    const rows = (await others.declarations.read({ ids })).filter((r) => wanted(ids, r));
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
    const id = await others.declarations.insert(fields, DECLARATION_CREATE, { repondantId: s.repondantId });
    await declarationModifiee(id);
    return id;
  },
  async update(actor, id, fields) {
    const s = requireActor(actor);
    const decl = await others.declarations.byId(id);
    if (!decl) throw new HttpError(404, 'Déclaration introuvable.');
    if (s.roles.includes('acheteur') && s.acheteurEntiteId) {
      await assertOwnMarche(s, num(decl.Marche));
    } else if (!(s.roles.includes('repondant') && num(decl.Repondant) === s.repondantId)) {
      throw forbidden();
    }
    await others.declarations.update(id, fields, new Set(['Statut']));
    await declarationModifiee(id);
  },
  async remove(actor, id) {
    const s = requireRole(actor, 'repondant');
    const decl = await others.declarations.byId(id);
    if (!decl || num(decl.Repondant) !== s.repondantId) throw forbidden();
    await others.declarations.remove(id);
  },
};

export const refus: TablePolicy = {
  async read(actor, { ids }) {
    const s = requireActor(actor);
    const rows = await others.refus.read({ ids });
    if (s.roles.includes('acheteur') && s.acheteurEntiteId) {
      const own = await ownMarcheIds(s.acheteurEntiteId);
      return rows.filter((r) => own.has(num(r.Marche)));
    }
    if (s.roles.includes('repondant') && s.repondantId) return rows.filter((r) => num(r.Marche_Titulaire) === s.repondantId);
    return [];
  },
  async create(actor, fields) {
    const s = requireRole(actor, 'acheteur');
    await assertOwnMarche(s, num(fields.Marche));
    // Date et auteur du refus sont posés par le serveur, quoi qu'envoie la page.
    const clean = omit({ id: 0, ...fields }, ['id', 'Refuse_le', 'Refuse_par']);
    if (!String(clean.Raison ?? '').trim()) throw new HttpError(400, 'Le motif du refus est obligatoire.');
    const user = await utilisateurParEmail(s.email);
    const id = await others.refus.insert(clean, new Set(['Marche', 'Raison']), { refuseParUtilisateurId: user?.id ?? null });
    await refusCree(id);
    return id;
  },
};

/* ---------------------------------------------------------------- Intérêts, coordonnées -- */

export const interets: TablePolicy = {
  async read(actor, { ids }) {
    const s = requireActor(actor);
    const rows = await others.interets.read({ ids });
    if (s.roles.includes('beneficiaire') && s.beneficiaireId) {
      const mine = rows.filter((r) => num(r.Beneficiaire) === s.beneficiaireId);
      if (mine.length || !s.roles.includes('repondant')) return mine;
    }
    if (s.roles.includes('repondant') && s.repondantId) {
      return rows.filter((r) => num(r.Marche_Titulaire) === s.repondantId || listIds(r.Marche_Candidats).includes(s.repondantId!));
    }
    return [];
  },
  async create(actor, fields) {
    const s = requireRole(actor, 'beneficiaire');
    return others.interets.insert({ Marche: fields.Marche }, new Set(['Marche']), { beneficiaireId: s.beneficiaireId });
  },
  async remove(actor, id) {
    const s = requireRole(actor, 'beneficiaire');
    const row = await others.interets.byId(id);
    if (!row || num(row.Beneficiaire) !== s.beneficiaireId) throw forbidden();
    await others.interets.remove(id);
  },
};

export const accesCoordonnees: TablePolicy = {
  async read(actor, { ids }) {
    const s = requireActor(actor);
    const rows = await others.accesCoordonnees.read({ ids });
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
    try {
      const id = await others.accesCoordonnees.insert(fields, new Set(['Marche', 'Beneficiaire', 'Affiche_email', 'Affiche_telephone']), { repondantId: s.repondantId });
      await accesCoordonneesCree(id);
      return id;
    } catch (e) {
      // Une consultation déjà enregistrée pour ce marché et ce bénéficiaire n'est pas notifiée deux fois.
      if ((e as { cause?: { code?: string } }).cause?.code === '23505') throw new HttpError(409, 'Consultation déjà enregistrée.');
      throw e;
    }
  },
};

/* ---------------------------------------------------------------- Mot de passe oublié ---- */

export const passwordReset: TablePolicy = {
  /** Demande publique : seule l'adresse e-mail est acceptée. Ne révèle jamais si le compte existe. */
  async create(_actor, fields) {
    const email = normaliser(String(fields.Email ?? ''));
    if (!email.includes('@') || email.length > 320) throw new HttpError(400, 'Adresse e-mail invalide.');
    await demandeMotDePasseOublie(email);
    return 0;
  },
};

export { marches };
