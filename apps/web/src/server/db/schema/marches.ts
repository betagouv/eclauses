import { boolean, date, doublePrecision, index, integer, pgTable, primaryKey, text, timestamp, unique, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { acheteurs, beneficiaires, repondants } from './acteurs';
import { statutDeclaration, statutInvitation, statutMarche } from './enums';
import { clausesSociales, specialites } from './referentiels';
import { utilisateurs } from './utilisateurs';

/**
 * Un marché est soit un marché simple, soit un marché parent, soit un lot (`parent_id` renseigné).
 * Les agrégats que Grist calculait (nombre de lots, statut global, titulaires de lots…) se
 * calculent par requête : voir `db/marches-expr.ts`.
 */
export const marches = pgTable(
  'marches',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    gristId: integer().unique(),
    parentId: integer().references((): AnyPgColumn => marches.id, { onDelete: 'restrict' }),
    acheteurId: integer()
      .notNull()
      .references(() => acheteurs.id),
    intitule: text().notNull(),
    numeroLot: text(),
    intituleLot: text(),
    clauseId: integer().references(() => clausesSociales.id),
    statut: statutMarche().notNull().default('en_attente_notification'),
    titulaireId: integer().references(() => repondants.id, { onDelete: 'set null' }),
    lienDocuments: text(),
    datePublication: date(),
    dateLimiteOffres: date(),
    dateNotificationPrevisionnelle: date(),
    dateFinExecution: date(),
    lieuExecution: text(),
    latitude: doublePrecision(),
    longitude: doublePrecision(),
    adresseGeocodee: text(),
    lotsLieuxDifferents: boolean().notNull().default(false),
    lotsClausesDifferentes: boolean().notNull().default(false),
    suivi: text().array(),
    /** Statistique : vrai si l'acheteur a créé le marché depuis le front, faux si l'équipe l'a fait depuis l'administration. */
    creationEnAutonomie: boolean().notNull().default(false),
    creeParUtilisateurId: integer().references(() => utilisateurs.id, { onDelete: 'set null' }),
    creeLe: timestamp({ withTimezone: true }).notNull().defaultNow(),
    modifieLe: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('marches_parent_idx').on(t.parentId),
    index('marches_acheteur_idx').on(t.acheteurId),
    index('marches_titulaire_idx').on(t.titulaireId),
    index('marches_statut_idx').on(t.statut),
  ],
);

export const marcheSpecialites = pgTable(
  'marche_specialites',
  {
    marcheId: integer().notNull().references(() => marches.id, { onDelete: 'cascade' }),
    specialiteId: integer().notNull().references(() => specialites.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.marcheId, t.specialiteId] })],
);

/** Bénéficiaires dont la participation au marché est validée par l'acheteur. */
export const marcheBeneficiaires = pgTable(
  'marche_beneficiaires',
  {
    marcheId: integer().notNull().references(() => marches.id, { onDelete: 'cascade' }),
    beneficiaireId: integer().notNull().references(() => beneficiaires.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.marcheId, t.beneficiaireId] }), index('marche_beneficiaires_benef_idx').on(t.beneficiaireId)],
);

/** Candidatures des répondants aux marchés. */
export const candidatures = pgTable(
  'candidatures',
  {
    marcheId: integer().notNull().references(() => marches.id, { onDelete: 'cascade' }),
    repondantId: integer().notNull().references(() => repondants.id, { onDelete: 'cascade' }),
    creeLe: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.marcheId, t.repondantId] }), index('candidatures_repondant_idx').on(t.repondantId)],
);

/** Un bénéficiaire signale son intérêt pour un marché. */
export const interetsMarches = pgTable(
  'interets_marches',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    marcheId: integer().notNull().references(() => marches.id, { onDelete: 'cascade' }),
    beneficiaireId: integer().notNull().references(() => beneficiaires.id, { onDelete: 'cascade' }),
    creeLe: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('interets_marche_beneficiaire_unique').on(t.marcheId, t.beneficiaireId)],
);

/** Consultation des coordonnées d'un bénéficiaire par un répondant, pour un marché. */
export const accesCoordonnees = pgTable(
  'acces_coordonnees',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    gristId: integer().unique(),
    repondantId: integer().notNull().references(() => repondants.id, { onDelete: 'cascade' }),
    marcheId: integer().notNull().references(() => marches.id, { onDelete: 'cascade' }),
    beneficiaireId: integer().notNull().references(() => beneficiaires.id, { onDelete: 'cascade' }),
    afficheEmail: boolean().notNull().default(false),
    afficheTelephone: boolean().notNull().default(false),
    creeLe: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('acces_coordonnees_unique').on(t.repondantId, t.marcheId, t.beneficiaireId)],
);

/** Invitation d'un titulaire à créer son espace pour déclarer ses bénéficiaires. */
export const invitationsTitulaires = pgTable(
  'invitations_titulaires',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    gristId: integer().unique(),
    marcheId: integer().notNull().references(() => marches.id, { onDelete: 'cascade' }),
    email: text().notNull(),
    statut: statutInvitation().notNull().default('en_attente'),
    repondantId: integer().references(() => repondants.id, { onDelete: 'set null' }),
    creeLe: timestamp({ withTimezone: true }).notNull().defaultNow(),
    traiteLe: timestamp({ withTimezone: true }),
    derniereRelanceLe: timestamp({ withTimezone: true }),
  },
  (t) => [index('invitations_marche_idx').on(t.marcheId)],
);

/** Déclaration, par le titulaire, d'un bénéficiaire mobilisé sur un marché. */
export const declarationsBeneficiaires = pgTable(
  'declarations_beneficiaires',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    gristId: integer().unique(),
    repondantId: integer().notNull().references(() => repondants.id, { onDelete: 'cascade' }),
    marcheId: integer().notNull().references(() => marches.id, { onDelete: 'cascade' }),
    estBeneficiaireEclauses: boolean().notNull().default(false),
    beneficiaireId: integer().references(() => beneficiaires.id, { onDelete: 'set null' }),
    nom: text(),
    prenom: text(),
    email: text(),
    statut: statutDeclaration().notNull().default('declare'),
    creeLe: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('declarations_marche_idx').on(t.marcheId), index('declarations_repondant_idx').on(t.repondantId)],
);

/** Refus, par l'acheteur, de la déclaration d'un marché. */
export const declarationsRefus = pgTable(
  'declarations_refus',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    gristId: integer().unique(),
    marcheId: integer().notNull().references(() => marches.id, { onDelete: 'cascade' }),
    refuseLe: timestamp({ withTimezone: true }).notNull().defaultNow(),
    refuseParUtilisateurId: integer().references(() => utilisateurs.id, { onDelete: 'set null' }),
    raison: text(),
  },
  (t) => [index('declarations_refus_marche_idx').on(t.marcheId)],
);
