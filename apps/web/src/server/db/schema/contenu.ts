import { boolean, index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { audience, typeIndicateur, zoneLien } from './enums';
import { clausesSociales } from './referentiels';

export const faqCategories = pgTable('faq_categories', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  gristId: integer().unique(),
  titre: text().notNull(),
  slug: text().notNull().unique(),
  description: text(),
  ordre: integer().notNull().default(0),
  publie: boolean().notNull().default(false),
});

export const faqQuestions = pgTable(
  'faq_questions',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    gristId: integer().unique(),
    categorieId: integer().references(() => faqCategories.id, { onDelete: 'set null' }),
    clauseId: integer().references(() => clausesSociales.id, { onDelete: 'set null' }),
    question: text().notNull(),
    reponse: text().notNull(),
    motsCles: text(),
    audience: audience().notNull().default('public'),
    auteur: text(),
    ordre: integer().notNull().default(0),
    publie: boolean().notNull().default(false),
    modifieLe: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('faq_questions_categorie_idx').on(t.categorieId)],
);

export const supportVideos = pgTable('support_videos', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  gristId: integer().unique(),
  clauseId: integer().references(() => clausesSociales.id, { onDelete: 'set null' }),
  libelle: text().notNull(),
  description: text(),
  url: text().notNull(),
  audience: audience().notNull().default('public'),
  auteur: text(),
  ordre: integer().notNull().default(0),
  publie: boolean().notNull().default(false),
  modifieLe: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/**
 * Indicateurs d'impact de la page d'accueil. La valeur affichée est la manuelle si elle existe, sinon
 * celle de l'indicateur calculé `indicateur` (voir `services/indicateurs.ts`).
 */
export const impacts = pgTable('impacts', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  gristId: integer().unique(),
  libelle: text().notNull(),
  description: text(),
  typeIndicateur: typeIndicateur().notNull(),
  valeurManuelle: text(),
  indicateur: text(),
  largeurColonnes: integer().notNull().default(1),
  ordre: integer().notNull().default(0),
});

/** Liens de l'en-tête et du pied de page. */
export const liens = pgTable('liens', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  gristId: integer().unique(),
  zone: zoneLien().notNull(),
  libelle: text().notNull(),
  url: text().notNull(),
  variante: text(),
  externe: boolean().notNull().default(false),
  ordre: integer().notNull().default(0),
});

/** Textes éditables du site : titre, badge, accroche, logo, pied de page, mentions RGPD… */
export const parametres = pgTable('parametres', {
  cle: text().primaryKey(),
  valeur: text().notNull(),
});
