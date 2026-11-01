import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { objectifJeton } from './enums';

/**
 * Une seule table de comptes, pour tous les rôles. Le rôle découle du profil rattaché
 * (bénéficiaire, répondant, utilisateur acheteur) ou de `est_admin`. Un compte sans mot de passe
 * est un compte créé mais pas encore activé.
 */
export const utilisateurs = pgTable(
  'utilisateurs',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    email: text().notNull(),
    motDePasseHash: text(),
    estAdmin: boolean().notNull().default(false),
    creeLe: timestamp({ withTimezone: true }).notNull().defaultNow(),
    motDePasseModifieLe: timestamp({ withTimezone: true }),
    derniereConnexionLe: timestamp({ withTimezone: true }),
  },
  (t) => [uniqueIndex('utilisateurs_email_unique').on(sql`lower(${t.email})`)],
);

/** Sessions révocables : le navigateur ne porte que l'identifiant, dont on ne garde que l'empreinte. */
export const sessions = pgTable(
  'sessions',
  {
    empreinte: text().primaryKey(),
    utilisateurId: integer()
      .notNull()
      .references(() => utilisateurs.id, { onDelete: 'cascade' }),
    creeLe: timestamp({ withTimezone: true }).notNull().defaultNow(),
    expireLe: timestamp({ withTimezone: true }).notNull(),
    revoqueLe: timestamp({ withTimezone: true }),
  },
  (t) => [index('sessions_utilisateur_idx').on(t.utilisateurId)],
);

/** Jetons à usage unique (activation, réinitialisation). Seule l'empreinte est stockée. */
export const jetonsAuth = pgTable(
  'jetons_auth',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    utilisateurId: integer()
      .notNull()
      .references(() => utilisateurs.id, { onDelete: 'cascade' }),
    objectif: objectifJeton().notNull(),
    empreinte: text().notNull().unique(),
    creeLe: timestamp({ withTimezone: true }).notNull().defaultNow(),
    expireLe: timestamp({ withTimezone: true }).notNull(),
    utiliseLe: timestamp({ withTimezone: true }),
  },
  (t) => [index('jetons_auth_utilisateur_idx').on(t.utilisateurId)],
);

/** Fichiers : le contenu est dans le stockage (local ou S3), la base ne garde que les métadonnées. */
export const fichiers = pgTable('fichiers', {
  id: uuid().primaryKey().defaultRandom(),
  cle: text().notNull().unique(),
  nomOriginal: text().notNull(),
  typeMime: text().notNull(),
  taille: integer().notNull(),
  sha256: text().notNull(),
  usage: text().notNull(),
  creeParUtilisateurId: integer().references(() => utilisateurs.id, { onDelete: 'set null' }),
  creeLe: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/** Mémoire des courriers déjà partis : évite les doublons quand un événement est rejoué. */
export const notificationsEnvoyees = pgTable(
  'notifications_envoyees',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    evenement: text().notNull(),
    cle: text().notNull(),
    envoyeLe: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('notifications_evenement_cle_unique').on(t.evenement, t.cle)],
);
