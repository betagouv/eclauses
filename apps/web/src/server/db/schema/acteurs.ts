import { sql } from 'drizzle-orm';
import { boolean, date, index, integer, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { categorieAcheteur } from './enums';
import { clausesSociales, departements, formations, regions, specialites } from './referentiels';
import { fichiers, utilisateurs } from './utilisateurs';

/** Entité acheteuse (ministère, service, opérateur). */
export const acheteurs = pgTable('acheteurs', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  gristId: integer().unique(),
  nom: text().notNull(),
  ministere: text(),
  categorie: categorieAcheteur(),
});

export const utilisateursAcheteurs = pgTable('utilisateurs_acheteurs', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  gristId: integer().unique(),
  utilisateurId: integer()
    .notNull()
    .unique()
    .references(() => utilisateurs.id, { onDelete: 'restrict' }),
  acheteurId: integer()
    .notNull()
    .references(() => acheteurs.id),
  nom: text().notNull(),
  prenom: text(),
});

/** Entreprise répondante : candidate à des marchés, puis éventuellement titulaire. */
export const repondants = pgTable('repondants', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  gristId: integer().unique(),
  utilisateurId: integer()
    .unique()
    .references(() => utilisateurs.id, { onDelete: 'set null' }),
  nom: text(),
  prenom: text(),
  telephone: text(),
  raisonSociale: text(),
  siret: text(),
  creeLe: timestamp({ withTimezone: true }).notNull().defaultNow(),
  /** Renseignée quand les données personnelles ont été effacées (durée de conservation dépassée). */
  anonymiseLe: date(),
});

/**
 * Personne en insertion issue des écoles (annuaire). `utilisateur_id` est vide quand la personne n'a
 * pas d'adresse e-mail connue ou après anonymisation. La date de diplomation (15 septembre de
 * l'année) est calculée par la base ; l'éligibilité, qui dépend de la date du jour, ne l'est pas.
 */
export const beneficiaires = pgTable(
  'beneficiaires',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    gristId: integer().unique(),
    utilisateurId: integer()
      .unique()
      .references(() => utilisateurs.id, { onDelete: 'set null' }),
    nom: text().notNull(),
    prenom: text(),
    telephone: text(),
    formationId: integer().references(() => formations.id),
    autreFormation: text(),
    anneeDiplome: integer(),
    dateDiplomation: date().generatedAlwaysAs(sql`make_date(annee_diplome, 9, 15)`),
    specialiteEcole: text(),
    sousSpecialite: text(),
    intituleMemoire: text(),
    autresInformations: text(),
    missionsProposees: text(),
    /** Note interne de l'équipe, jamais exposée aux utilisateurs. */
    commentaire: text(),
    cvFichierId: uuid().references(() => fichiers.id, { onDelete: 'set null' }),
    consentementAnnuaire: boolean().notNull().default(false),
    consentementContactGroupements: boolean().notNull().default(false),
    alumni: boolean().notNull().default(false),
    ficheAJour: boolean().notNull().default(false),
    creeLe: timestamp({ withTimezone: true }).notNull().defaultNow(),
    modifieLe: timestamp({ withTimezone: true }).notNull().defaultNow(),
    anonymiseLe: date(),
  },
  (t) => [index('beneficiaires_formation_idx').on(t.formationId)],
);

export const beneficiaireSpecialites = pgTable(
  'beneficiaire_specialites',
  {
    beneficiaireId: integer().notNull().references(() => beneficiaires.id, { onDelete: 'cascade' }),
    specialiteId: integer().notNull().references(() => specialites.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.beneficiaireId, t.specialiteId] }), index('beneficiaire_specialites_spec_idx').on(t.specialiteId)],
);

export const beneficiaireDepartements = pgTable(
  'beneficiaire_departements',
  {
    beneficiaireId: integer().notNull().references(() => beneficiaires.id, { onDelete: 'cascade' }),
    departementId: integer().notNull().references(() => departements.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.beneficiaireId, t.departementId] }), index('beneficiaire_departements_dep_idx').on(t.departementId)],
);

export const beneficiaireRegions = pgTable(
  'beneficiaire_regions',
  {
    beneficiaireId: integer().notNull().references(() => beneficiaires.id, { onDelete: 'cascade' }),
    regionId: integer().notNull().references(() => regions.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.beneficiaireId, t.regionId] }), index('beneficiaire_regions_region_idx').on(t.regionId)],
);

/** Clauses sociales auxquelles le bénéficiaire est rattaché (alimente l'annuaire par clause). */
export const beneficiaireClauses = pgTable(
  'beneficiaire_clauses',
  {
    beneficiaireId: integer().notNull().references(() => beneficiaires.id, { onDelete: 'cascade' }),
    clauseId: integer().notNull().references(() => clausesSociales.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.beneficiaireId, t.clauseId] }), index('beneficiaire_clauses_clause_idx').on(t.clauseId)],
);
