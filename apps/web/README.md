# Application web Eclauses (réécriture)

Next.js (App Router) et TypeScript, avec **PostgreSQL** (Drizzle) pour les données et un stockage de fichiers local (interface prête pour S3). Plus aucun appel à Grist à l'exécution : Grist ne sert que d'**source d'import** (phase 6). Voir [le cadrage et le schéma](../../docs/80-reecriture/03-postgres-phases-0-1.md) et [la couche d'accès aux données](../../docs/80-reecriture/04-phase-2-acces-aux-donnees.md).

## Démarrer

```bash
npm install                                                       # à la racine du dépôt
cp apps/web/.env.example apps/web/.env.local                      # renseigner POSTGRES_PASSWORD, DATABASE_URL
docker compose --env-file apps/web/.env.local up -d db            # PostgreSQL 16 sur 127.0.0.1:5434
npm run db:migrate -w apps/web                                    # applique les migrations (apps/web/drizzle)
npx tsx apps/web/scripts/seed-dev.ts                              # données de démonstration (base locale uniquement)
npm run dev -w apps/web                                           # http://localhost:3000
```

Après une modification du schéma (`src/server/db/schema`) : `npm run db:generate -w apps/web`, relire le SQL généré, puis `db:migrate`.

## Tests

```bash
npm test -w apps/web          # unitaires + intégration (les tests d'intégration créent une base jetable à côté de la vôtre)
npm run typecheck -w apps/web
npx tsx apps/web/scripts/smoke.ts   # parcours HTTP de bout en bout (54 contrôles) contre une instance démarrée (BASE_URL, 3100 par défaut) et une base seedée
```

Stockage S3 : `docker compose --env-file apps/web/.env.local --profile s3 up -d minio` puis les variables `S3_TEST_*` (voir `.env.example`) activent la partie S3 du test de contrat.

## Importer les données de Grist

```bash
npx tsx apps/web/scripts/import-grist.ts --replace     # Grist (GRIST_DOC_ID, lecture seule) -> base locale ; rejouable sans --replace
npx tsx apps/web/scripts/verify-import.ts              # compare les formules de Grist avec celles du nouveau code (0 écart attendu)
```

Sans `DATABASE_URL`, les tests d'intégration sont ignorés. Ils n'écrivent jamais dans la base de développement elle-même.

## Docker

```bash
docker compose --env-file apps/web/.env.local up -d --build   # base + application, http://localhost:3200
```

L'image applique les migrations au démarrage, garde les fichiers dans le volume `fichiers` (`/data/fichiers`, ou `STORAGE_DRIVER=s3`), tourne en utilisateur non root, système de fichiers en lecture seule, sans capacité Linux, sonde de santé sur `/api/health`.

## Organisation

| Dossier | Rôle |
|---|---|
| `src/app` | Routes : `[page]` (toutes les pages, contrôle d'accès, redirection vers la connexion), `page.tsx` (accueil et anciens liens `?page=`), `api/*` (auth, CV, pièces jointes, support, relance, tâches, santé) |
| `src/features` | Les pages, par espace (`public`, `beneficiaire`, `acheteur`, `repondant`) : un **composant serveur** qui lit les données, et, si besoin, un **îlot client** pour l'interactivité. `registry.tsx` associe chaque page à son rendu |
| `src/server/actions` | Server Actions : écritures et relectures des pages (session relue à chaque appel, résultat renvoyé en valeur) |
| `src/server/services` | Opérations métier transactionnelles (acheteur, répondant, candidats), comptes et jetons, courriers, mémoire des envois, fichiers, indicateurs |
| `src/server/db` | Schéma Drizzle (`schema/`), connexion, expressions SQL des règles de conservation, libellés des statuts |
| `src/server/compat`, `policies`, `tables.ts` | Lecture et écriture des tables sous la forme que les pages utilisent (noms de colonnes d'origine, listes d'identifiants), et droits de chaque rôle (refus par défaut) |
| `src/server/storage` | Interface `FileStore`, pilotes local et S3 |
| `src/server/auth` | Mots de passe (scrypt), sessions révocables, rôles |
| `src/server/mail` | Transport (SMTP ou journal), gabarits, description d'un marché avec ou sans lot |
| `src/server/jobs.ts` | Tâches de conservation des données et de nettoyage, appelées par un planificateur |
| `src/server/grist` | Client Grist, conservé pour les seuls scripts d'import et de vérification |
| `src/lib`, `src/components` | Registre des pages, navigation, utilitaires, composants partagés (liste déroulante, impression) |

Voir [docs/80-reecriture/07-pages-rendues-par-le-serveur.md](../../docs/80-reecriture/07-pages-rendues-par-le-serveur.md) pour le principe et la recette de conversion d'une page.
