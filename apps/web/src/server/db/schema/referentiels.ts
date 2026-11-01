import { doublePrecision, integer, pgTable, text } from 'drizzle-orm/pg-core';

export const formations = pgTable('formations', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  gristId: integer().unique(),
  intitule: text().notNull(),
});

export const regions = pgTable('regions', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  gristId: integer().unique(),
  intitule: text().notNull(),
  chefLieu: text(),
  latitude: doublePrecision(),
  longitude: doublePrecision(),
  adresseGeocodee: text(),
});

export const departements = pgTable('departements', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  gristId: integer().unique(),
  numero: text().notNull().unique(),
  nom: text().notNull(),
  regionId: integer().references(() => regions.id),
  libelleAffichage: text(),
  chefLieu: text(),
  villesPrincipales: text(),
  superficieKm2: doublePrecision(),
  population2023: integer(),
  densiteHabKm2: doublePrecision(),
  latitude: doublePrecision(),
  longitude: doublePrecision(),
  adresseGeocodee: text(),
});

export const clausesSociales = pgTable('clauses_sociales', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  gristId: integer().unique(),
  nom: text().notNull(),
  gabaritArticle: text(),
  gabaritAnnuaireHtml: text(),
});

export const specialites = pgTable('specialites', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  gristId: integer().unique(),
  intitule: text().notNull(),
  clauseId: integer().references(() => clausesSociales.id),
  infobulle: text(),
});
