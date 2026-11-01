# Sortie de Grist : cadrage et modèle PostgreSQL (phases 0 et 1)

Branche `rewrite-postgres` (issue de `rewrite`). Cette étape pose la base et le schéma. **Le code applicatif lit encore Grist** : rien n'est branché sur PostgreSQL à ce stade et PROD n'a pas été touchée (le DEV n'a été lu qu'en lecture seule, voir `apps/web/scripts/inspect-formulas.ts`).

## Décisions

| Sujet | Choix |
|---|---|
| Base | PostgreSQL 16 ; auto-hébergée en développement (`docker compose up -d db`, port local 5434), configurée par `DATABASE_URL` ; Scaleway en production |
| ORM et migrations | Drizzle (`apps/web/drizzle/`, `npm run db:generate`, `npm run db:migrate`) |
| Fichiers | Stockage local derrière une interface, bascule S3 prévue (phase 4) ; seules les métadonnées sont en base (`fichiers`) |
| Back-office | Application d'administration intégrée au projet (phase 7) |
| Données migrées | Tables métier seulement |

## Tri des 40 tables Grist

**Migrées (23 tables métier ou de contenu)**

| Grist | PostgreSQL |
|---|---|
| `Beneficiaires` | `beneficiaires` + `beneficiaire_specialites`, `_departements`, `_regions`, `_clauses` |
| `Marches` | `marches` (parent/lots par `parent_id`) + `marche_specialites`, `candidatures` (les bénéficiaires d'un marché sont ses déclarations) |
| `Acheteurs`, `Utilisateurs_Acheteurs` | `acheteurs`, `utilisateurs_acheteurs` |
| `Repondants` | `repondants` (+ `candidatures`) |
| `Invitation_Titulaire` | `invitations_titulaires` |
| `Declarations_Beneficiaires`, `_Refus` | `declarations_beneficiaires`, `declarations_refus` |
| `Marches_Interets`, `Acces_Coordonnees` | `interets_marches`, `acces_coordonnees` |
| `Clauses_sociales` | `clauses_sociales` |
| `T0_Referentiel_*` | `formations`, `regions`, `departements`, `specialites` ; les mentions RGPD vont dans `parametres` |
| `Application_AuthUser`, `AuthLink`, `Application_Password_Reset` | `utilisateurs`, `sessions`, `jetons_auth` |
| `Application_FAQ_*`, `Support_Videos`, `Impacts` | `faq_categories`, `faq_questions`, `support_videos`, `impacts` |
| `Application_Header/Footer/Liens` | `liens` (zone) + `parametres` |
| (nouveau) | `fichiers`, `notifications_envoyees` |

**Abandonnées** : `Z_*` (Libs, Gabarits, Tests, Documents_de_l_equipe, HTML_Page), `Application_Composants` et `Application_AI_*` (les pages sont du code), `Application_Env` (configuration par variables d'environnement), `TECHNIQUE_THIBAUD`, `MC_Resume_des_niveaux`, `Liste_des_Entites_beneficiaires`, `Chemin_complet_PLACE_Restit`, `ActionsManuelles`, `Schema`.

## Ce qui change par rapport à Grist

- **Comptes** : une table `utilisateurs` (e-mail unique sans tenir compte de la casse, mot de passe nul tant que le compte n'est pas activé). Le rôle découle du profil rattaché ou de `est_admin`. Remplace `AuthLink` (0 ligne en DEV), `Application_AuthUser` et la recherche d'identité par e-mail.
- **Jetons** : seule l'empreinte est stockée, usage unique. Une relance génère un **nouveau** jeton (l'ancien n'a plus à être relisible).
- **Sessions** : révocables côté serveur.
- **Listes `['L', …]`** : remplacées par des tables de jointure ; plus de format `L` à terme.
- **Statuts** : énumérations à valeurs stables (`clause_validee`…) ; les libellés d'origine sont dans `db/labels.ts`, avec la correspondance inverse pour l'import et la couche de compatibilité.
- **Dates** : `date` ou `timestamptz` au lieu de secondes epoch.
- **Notifications** : `notifications_envoyees` (unique par événement et clé) remplace le marqueur `Ne_Doit_Pas_Notifier`.
- **Anonymisation** : on efface les champs et on met `anonymise_le` ; le profil reste pour conserver l'historique.

## Colonnes formules (144) : ce qu'elles deviennent

- **Règles de conservation** : calculées à la lecture (`db/expr.ts`). Éligible = diplomation + 5 ans 6 mois > aujourd'hui ; à détruire = diplomation + 10 ans < aujourd'hui ; répondant à détruire = mot de passe modifié il y a plus de 5 ans. `date_diplomation` (15 septembre de l'année) est une colonne générée.
- **Agrégats de marchés** (nombre de lots, statut global, titulaires et bénéficiaires de tous les lots, intitulé propre, libellé de lot, racine) : à calculer par requête dans la couche d'accès (phase 2). Les règles de Grist sont relevées dans le DEV : `Statut_global` d'un parent = « validée » si tous les lots le sont, sinon « à valider » si l'un l'est, sinon « en attente de déclaration », etc.
- **Notifier la publication** : parent + statut `en_attente_notification` + non déjà envoyé.
- **Archiver** : statut `clause_validee` et fin d'exécution + 4 ans 6 mois dépassée.
- **Acheteur autonome** : existence d'un marché avec `creation_en_autonomie`.
- **Inverses de listes** (`Candidats`, `Titulaire_aux_marches`, `Marches` d'un acheteur…) : jointures.
- **Abandonnées** : HTML de statistiques, liens `mailto` (`Email_1`, `Email_2`), géocodage (`Doit_Geocoder`), `Lien_Inscription_Candidat`, champs de test `A`/`B`/`C`.

## Données DEV relevées (lecture seule)

275 bénéficiaires, 128 acheteurs, 27 marchés, 15 répondants, 6 utilisateurs acheteurs, 16 comptes, 15 invitations, 20 déclarations, 2 accès aux coordonnées, 2 clauses. Statuts de marché présents : clause validée (15), en attente de notification (7), en attente de déclaration (3), archivé (1), déclaration à valider (1).

## Vérifié

- Migration `0000_schema_initial` appliquée sur un PostgreSQL 16 réel.
- 9 tests d'intégration sur une base jetable (`tests/db-schema.test.ts`) : unicité d'e-mail insensible à la casse, date de diplomation et éligibilité, parent/lots protégés, énumérations, doublons de notification, suppression d'un compte ou d'un fichier sans perdre le profil.
- 50 tests au total passent ; `tsc` propre.

## Points à confirmer avant l'import (phase 6)

1. `Marches.Suivi` : liste de textes dont le sens n'est pas documenté ; stockée telle quelle (`text[]`).
2. `Beneficiaires.Courriel_Eclauses` est cité par une formule mais absent du schéma lu ; non repris.
3. `Beneficiaires.Clef_secrete` : abandonnée (plus utilisée par le nouveau code).
4. `Clauses_sociales.Documents` (issu de `Z_Documents_de_l_equipe`) : non repris, à décider si les clauses doivent avoir des documents.
5. Les bénéficiaires sans e-mail n'ont pas de compte (`utilisateur_id` vide) ; l'import produira un rapport.
6. `Application_Header.Tagline` est une formule : sa valeur sera figée dans `parametres` à l'import.

## Suite

Phase 2 : couche d'accès aux données (dépôts) et politiques d'accès réécrites dessus.
