# Pages rendues par le serveur (Server Components et Server Actions)

Branche `rewrite-postgres`. Décision prise après lecture de la documentation de Next.js 16 (`node_modules/next/dist/docs/01-app/01-getting-started/06-fetching-data.md` et `07-mutating-data.md`).

## Le principe

| | Avant (pages reprises du widget Grist) | Maintenant (pages converties) |
|---|---|---|
| Lecture | le navigateur télécharge le code, puis appelle `/api/data/...` | le serveur lit la base au moment du rendu et envoie un **HTML déjà rempli** |
| Écriture | `fetch` vers `/api/data` | **Server Actions** (un seul aller-retour, interface et données mises à jour) |
| Interactivité | tout est dans le navigateur | seulement les îlots qui en ont besoin (filtres, carte, modales, formulaire) |
| API HTTP | indispensable | gardée pour les consommateurs externes (CV, tâches planifiées) |

## Comment c'est organisé

- `src/features/registry.tsx` : la liste des pages rendues par le serveur. Une page absente garde l'ancien mode (`PageHost`). Un test vérifie qu'une page est dans l'un ou l'autre, jamais les deux.
- `src/features/<rôle>/<Page>.tsx` : **composant serveur**, il lit les données avec `loadTables` (`src/server/page-data.ts`, mêmes politiques d'accès que `/api/data`, lectures en parallèle) et rend un îlot.
- `src/features/<rôle>/<Page>List.tsx` ou `ProfilForm.tsx` : **îlot client** (le code de l'ancienne page, retouché). Il reçoit `initial` et `session` en propriétés, son premier rendu est déjà complet.
- `src/server/actions/*.ts` (`'use server'`) : écritures. La session est relue dans chaque action (une action est joignable par un POST direct), et les mêmes politiques s'appliquent. Les erreurs attendues sont renvoyées en valeur (`ActionResult`), car Next.js masque le message d'une exception en production.

## Pages converties

| Page | Mode |
|---|---|
| `accueil` | entièrement serveur (aucun JavaScript propre) |
| `beneficiaire-home` | entièrement serveur |
| `beneficiaire-profil` | serveur + îlot formulaire, écriture par action, CV par la route existante |
| `beneficiaire-marches` | serveur + îlot (filtres, carte), favoris par actions |
| `beneficiaire-annuaire` | serveur + îlot (filtres, carte, fiche, aperçu du CV) |

## Mesures (production, en local)

- Le contenu des pages est dans le HTML reçu (annuaire : « 56 bénéficiaire(s) », profil prérempli) ; la page `acheteur-marches`, restée en ancien mode, n'en contient aucun mot.
- **Aucun appel `/api/*` au chargement** des pages converties ; plus de « Chargement… ».
- Page profil complète en 150 ms environ ; HTML en 10 à 180 ms selon la page (l'annuaire envoie 135 Ko).

## Défauts trouvés et corrigés en route

- `gristAPI.addRecord` et `deleteRecord` levaient une erreur : **toute écriture par création ou suppression depuis les pages non converties était cassée** (favoris, invitation d'un titulaire, déclarations…). Corrigé dans l'attente de leur conversion.
- Les CV ont maintenant un identifiant opaque : le profil du bénéficiaire et la fiche d'un marché côté acheteur convertissaient cet identifiant en nombre et **n'affichaient jamais le CV**. Corrigé.
- Un attribut `autocomplete` mal écrit dans la page de connexion (avertissement React).

## Règle à respecter pour convertir une page

Le code repris du widget lit la session par un **état global** du module (`gristAPI.getAuth()`). Côté serveur, un état global est partagé entre les requêtes : **ne jamais rendre sur le serveur une page qui s'appuie sur lui**. Les îlots reçoivent `session` en propriété, importent `ComboBox` directement, et n'utilisent ni `gristAPI.getAuth`, ni `getComponent`, ni `getData`.

Recette : copier la page dans `features/`, remplacer le chargement `useEffect` par `initial` (états initialisés depuis les propriétés, calculs dérivés en `useMemo` plutôt qu'en effets), remplacer les écritures par une action, laisser dans un effet seulement ce qui touche le navigateur (carte Leaflet, titre), écrire le composant serveur qui charge les tables, l'inscrire dans le registre, retirer l'entrée de `PageHost`.

## Reste à faire

20 pages en ancien mode : acheteur (8), répondant (5), support, statistiques, inscription, connexion, mot de passe, pages légales. Les 8 pages acheteur et les 5 pages répondant sont les plus lourdes et portent la plupart des écritures. À l'issue de leur conversion, la couche de compatibilité et le shim `gristAPI` pourront être supprimés.
