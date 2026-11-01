# Application web Eclauses (réécriture)

Next.js (App Router) et TypeScript, avec **PostgreSQL** (Drizzle) pour les données et un stockage de fichiers local (interface prête pour S3). Plus aucun appel à Grist à l'exécution : Grist ne sert que d'**source d'import** (phase 6). Voir [le cadrage et le schéma](../../docs/80-reecriture/03-postgres-phases-0-1.md) et [la couche d'accès aux données](../../docs/80-reecriture/04-phase-2-acces-aux-donnees.md).

## Démarrer

```bash
npm install                                                       # à la racine du dépôt
cp apps/web/.env.example apps/web/.env.local                      # renseigner POSTGRES_PASSWORD, DATABASE_URL, SESSION_SECRET
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
npx tsx apps/web/scripts/smoke.ts   # parcours HTTP de bout en bout contre une instance démarrée (BASE_URL, 3100 par défaut) et la base seedée
```

Sans `DATABASE_URL`, les tests d'intégration sont ignorés. Ils n'écrivent jamais dans la base de développement elle-même.

## Docker

```bash
docker compose --env-file apps/web/.env.local up -d --build   # base + application, http://localhost:3200
```

L'image tourne en utilisateur non root, système de fichiers en lecture seule, sans capacité Linux, sonde de santé sur `/api/health`. **À faire (phase 8)** : appliquer les migrations au démarrage et monter un volume pour les fichiers (`STORAGE_LOCAL_DIR`).

## Organisation

| Dossier | Rôle |
|---|---|
| `src/server/db` | Schéma Drizzle (`schema/`), connexion, expressions SQL des règles de conservation, libellés des statuts |
| `src/server/compat` | Couche de compatibilité : présente les lignes dans la forme attendue par les pages héritées de Grist, et traduit leurs écritures (disparaît page par page) |
| `src/server/policies`, `tables.ts` | Droits : ce que chaque rôle lit, crée, modifie, supprime (refus par défaut) |
| `src/server/services` | Comptes et jetons, notifications par courrier, mémoire des envois, fichiers, indicateurs |
| `src/server/storage` | Interface `FileStore` et pilote local (S3 à venir) |
| `src/server/auth` | Mots de passe (scrypt, SHA-256 historique accepté puis remplacé), sessions, rôles |
| `src/server/mail` | Transport (SMTP ou journal), gabarits, description d'un marché avec ou sans lot |
| `src/server/jobs.ts` | Tâches de conservation des données, appelées par un planificateur |
| `src/server/grist` | Client Grist, conservé pour le seul script d'import |
| `src/app/api` | Routes : auth, données, CV, tâches, support, relance, santé |
| `src/app/[page]` | Une route par page, contrôle d'accès, en-tête, menu et pied de page |
| `src/legacy` | Code des pages du widget Grist repris tel quel, et `gristAPI` côté navigateur |

## Reprendre une page du widget



```bash
node apps/web/scripts/port-page.mjs <nom-de-page>              # grist/page/<nom> -> src/legacy/pages/<nom>.tsx
node apps/web/scripts/port-page.mjs <nom> --component          # grist/composants/<nom>
```

Le script n'ajoute qu'un en-tête et un export. Ensuite on adapte à la main les appels qui n'ont pas d'équivalent (upload, jeton, lecture ciblée), puis on ajoute la route à `src/app`. La page `beneficiaire-profil` a été portée ainsi : environ 750 lignes sur 816 sont inchangées.
