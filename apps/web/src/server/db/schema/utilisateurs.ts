import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
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
    /** Secret TOTP chiffré (AES-GCM) ; actif une fois confirmé. `totpActiveLe` marque l'activation de la double authentification, quelle que soit la méthode. */
    totpSecretChiffre: text(),
    totpActiveLe: timestamp({ withTimezone: true }),
    /** Dernier pas de 30 s accepté : un même code ne sert pas deux fois. */
    totpDernierPas: integer(),
    /** Méthode de seconde étape : `app` (application d'authentification) ou `courrier` (code reçu par e-mail). Vide sur un compte actif = `app`. */
    mfaMethode: text(),
    /** Code à usage unique envoyé par e-mail (méthode `courrier`) : empreinte HMAC et expiration, effacées dès l'usage. */
    mfaCodeEmpreinte: text(),
    mfaCodeExpireLe: timestamp({ withTimezone: true }),
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
    /** Seconde étape (administrateurs) validée à cet instant ; vide = pas de double authentification faite. */
    mfaValideLe: timestamp({ withTimezone: true }),
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

/** Compteurs du limiteur de débit : un par clé (action + adresse IP et/ou e-mail), partagés entre instances. */
export const limitesDebit = pgTable('limites_debit', {
  cle: text().primaryKey(),
  compteur: integer().notNull(),
  finFenetre: timestamp({ withTimezone: true }).notNull(),
});

/** Codes de secours de la double authentification : à usage unique, seule l'empreinte est stockée. */
export const codesSecours = pgTable(
  'codes_secours',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    utilisateurId: integer()
      .notNull()
      .references(() => utilisateurs.id, { onDelete: 'cascade' }),
    empreinte: text().notNull(),
    utiliseLe: timestamp({ withTimezone: true }),
  },
  (t) => [index('codes_secours_utilisateur_idx').on(t.utilisateurId)],
);

/** Journal d'audit de l'administration : qui a fait quoi, sur quoi, quand. L'adresse est recopiée (le compte peut disparaître). */
export const auditAdmin = pgTable(
  'audit_admin',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    utilisateurId: integer().references(() => utilisateurs.id, { onDelete: 'set null' }),
    email: text().notNull(),
    action: text().notNull(),
    entite: text().notNull(),
    entiteId: text(),
    details: jsonb(),
    creeLe: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('audit_admin_date_idx').on(t.creeLe), index('audit_admin_entite_idx').on(t.entite, t.entiteId)],
);
