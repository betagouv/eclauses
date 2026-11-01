# Application web Eclauses (prototype de réécriture)

Next.js (App Router) et TypeScript. Grist reste la base de données : le serveur lui parle avec une clé de service, le navigateur ne voit jamais cette clé. Voir [le bilan du prototype](../../docs/80-reecriture/01-bilan-prototype.md) et [le port complet](../../docs/80-reecriture/02-port-complet.md) (pages, flux n8n repris, droits, mise en production).

## Démarrer

```bash
npm install                                  # à la racine du dépôt
cp apps/web/.env.example apps/web/.env.local # puis renseigner GRIST_DOC_ID (DEV), GRIST_API_KEY, SESSION_SECRET
npm run dev                                  # http://localhost:3000
npm test                                     # tests unitaires
npm run typecheck
```

Un prototype ne doit viser que le document **DEV**. Le script `scripts/seed-proto-user.ts` refuse tout autre document.

## Vérifier de bout en bout

```bash
npx tsx scripts/seed-proto-user.ts   # crée dans DEV un bénéficiaire, un acheteur et un répondant de test (domaine .test)
npx tsx scripts/smoke.ts             # bénéficiaire : connexion, droits, profil, CV (BASE_URL pour changer d'hôte)
npx tsx scripts/smoke-roles.ts       # visiteur, acheteur, répondant : droits de lecture et d'écriture
npx tsx scripts/smoke-flows.ts       # lien reçu par courrier, usage unique, support, vérification de candidat
npx tsx scripts/dry-run-events.ts    # gestionnaires d'événements sur des lignes réelles, sans envoi ni écriture
npx tsx scripts/bench-grist.ts       # latence des appels Grist
npm run gen:schema -w apps/web       # régénère les types du schéma Grist
```

## Docker

```bash
docker compose up -d --build   # http://localhost:3200, secrets lus dans apps/web/.env.local
```

L'image (Next.js en sortie `standalone`) tourne en utilisateur non root, système de fichiers en lecture seule, sans capacité Linux, avec une sonde de santé sur `/api/health`. En production sur Scaleway, injecter `GRIST_*` et `SESSION_SECRET` comme secrets du conteneur, jamais dans l'image.

## Organisation

| Dossier | Rôle |
|---|---|
| `src/server/grist` | Client Grist (records, SQL, pièces jointes) et types générés du schéma |
| `src/server/auth` | Mots de passe (scrypt, SHA-256 historique accepté puis remplacé), sessions signées, rôles |
| `src/server/beneficiaires.ts`, `tables.ts` | Politiques d'accès : ce que chaque rôle lit et modifie (remplacent les ACL Grist) |
| `src/server/policies` | Un fichier par domaine : ce que chaque rôle lit, crée, modifie, supprime (remplace les ACL Grist) |
| `src/server/cv.ts` | Contrôle des CV par le contenu du fichier |
| `src/server/mail` | Transport (SMTP ou journal), gabarits, description d'un marché avec ou sans lot |
| `src/server/events` | Gestionnaires des webhooks Grist (remplacent les flux n8n) |
| `src/server/jobs.ts` | Tâches de conservation des données, appelées par un planificateur |
| `src/app/api` | Routes : auth, données, CV, webhooks, tâches, support, relance, santé |
| `src/app/[page]` | Une route par page, contrôle d'accès, en-tête, menu et pied de page |
| `src/legacy` | Code des pages du widget Grist repris tel quel, et `gristAPI` côté navigateur |

## Reprendre une page du widget

```bash
node apps/web/scripts/port-page.mjs <nom-de-page>              # grist/page/<nom> -> src/legacy/pages/<nom>.tsx
node apps/web/scripts/port-page.mjs <nom> --component          # grist/composants/<nom>
```

Le script n'ajoute qu'un en-tête et un export. Ensuite on adapte à la main les appels qui n'ont pas d'équivalent (upload, jeton, lecture ciblée), puis on ajoute la route à `src/app`. La page `beneficiaire-profil` a été portée ainsi : environ 750 lignes sur 816 sont inchangées.
