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
| `acheteur-home` | entièrement serveur (alerte « déclarations à valider » comptée en base) |
| `acheteur-infos`, `acheteur-statistiques` | serveur + îlot |
| `acheteur-annuaire` | serveur + îlot (filtres, deux cartes, fiche, aperçu du CV) |
| `acheteur-marches` | serveur + îlot : publication, invitation, relance, suppression par actions |
| `acheteur-marches-declaration` | serveur + îlot : le marché et ses lots sont créés par **une** action, en une transaction |
| `acheteur-marches-modification` | serveur + îlot : marché, lots ajoutés, modifiés ou supprimés en une transaction |
| `acheteur-marches-detail` | serveur + îlot : invitation, relance, validation et refus des déclarations par actions |

## Mesures (production, en local)

- Le contenu des pages est dans le HTML reçu (annuaire : « 56 bénéficiaire(s) », profil prérempli) ; la page `acheteur-marches`, restée en ancien mode, n'en contient aucun mot.
- **Aucun appel `/api/*` au chargement** des pages converties ; plus de « Chargement… ».
- Page profil complète en 150 ms environ ; HTML en 10 à 180 ms selon la page (l'annuaire envoie 135 Ko).

## Opérations métier de l'acheteur (`services/marches-acheteur.ts`)

Les anciennes pages enchaînaient plusieurs écritures depuis le navigateur (créer un marché puis chaque lot ; inviter, puis changer le statut du lot, puis celui du parent…). Un échec au milieu laissait des données à moitié écrites. Ces enchaînements sont maintenant des **services serveur**, chacun en une transaction, après contrôle du rôle et de la propriété du marché, avec la validation des champs (zod) refaite côté serveur :

| Service | Règle |
|---|---|
| `declarerMarche` | marché simple ou alloti, statut « en attente de publication », date limite non passée, numéros de lot uniques |
| `modifierMarche` | marché parent seulement ; un lot à supprimer ou modifier doit appartenir à ce marché |
| `supprimerMarche` | le marché et ses lots, invitations et déclarations |
| `publierMarche` | marché et lots « en attente de notification », `https://` ajouté au lien ; prévient les bénéficiaires |
| `inviterTitulaire` | invitation, statut du lot, puis du parent : « en attente de déclaration » seulement quand tous les lots sont invités, sinon retour à « en attente de notification » |
| `relancerTitulaire` | un seul courrier par délai (`RELANCE_TITULAIRE_DELAY_DAYS`), **contrôlé côté serveur** : avant, seule la page le vérifiait |
| `validerDeclaration` | uniquement au statut « à valider » avec au moins une déclaration ; le parent est validé quand tous ses lots le sont |
| `refuserDeclaration` | motif obligatoire, déclarations remises en « brouillon », retour en « en attente de déclaration » |

La navigation entre pages n'utilise plus `sessionStorage` : le marché est dans l'adresse (`/acheteur-marches-detail?id=12`), ce qui permet le retour arrière, le partage d'un lien et le rendu serveur.

## Défauts du modèle trouvés en lisant les flux d'écriture

- Les marchés créés depuis le front partent « en attente de publication » : ce statut **n'existait pas** dans mes énumérations, donc la déclaration d'un marché aurait échoué. Ajouté (migration `0005`).
- Un refus remet les déclarations en « brouillon » : valeur absente aussi. Ajoutée (même migration).
- Le SQL d'une migration ne peut pas utiliser une valeur d'énumération ajoutée dans la même transaction : la valeur par défaut du statut d'un marché reste donc « en attente de notification » en base, et le service la fixe explicitement à la création.
- Une référence qui n'existe plus (spécialité supprimée) donnait une erreur 500 ; c'est maintenant un message de saisie lisible, sans rien écrire.

## Défauts trouvés et corrigés en route

- `gristAPI.addRecord` et `deleteRecord` levaient une erreur : **toute écriture par création ou suppression depuis les pages non converties était cassée** (favoris, invitation d'un titulaire, déclarations…). Corrigé dans l'attente de leur conversion.
- Les CV ont maintenant un identifiant opaque : le profil du bénéficiaire et la fiche d'un marché côté acheteur convertissaient cet identifiant en nombre et **n'affichaient jamais le CV**. Corrigé.
- Un attribut `autocomplete` mal écrit dans la page de connexion (avertissement React).

## Règle à respecter pour convertir une page

Le code repris du widget lit la session par un **état global** du module (`gristAPI.getAuth()`). Côté serveur, un état global est partagé entre les requêtes : **ne jamais rendre sur le serveur une page qui s'appuie sur lui**. Les îlots reçoivent `session` en propriété, importent `ComboBox` directement, et n'utilisent ni `gristAPI.getAuth`, ni `getComponent`, ni `getData`.

Recette : copier la page dans `features/`, remplacer le chargement `useEffect` par `initial` (états initialisés depuis les propriétés, calculs dérivés en `useMemo` plutôt qu'en effets), remplacer les écritures par une action, laisser dans un effet seulement ce qui touche le navigateur (carte Leaflet, titre), écrire le composant serveur qui charge les tables, l'inscrire dans le registre, retirer l'entrée de `PageHost`.

## Reste à faire

16 pages en ancien mode : répondant (4 : accueil, infos, marchés, recherches), support (2), statistiques, inscription d'un candidat, connexion, mot de passe oublié, réinitialisation, et les pages légales (CGU, mentions, données personnelles, accessibilité, à propos). Une fois toutes converties, la couche de compatibilité (`/api/data`, `compat/`) et le shim `gristAPI` pourront être supprimés.
