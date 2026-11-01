# Bilan du prototype de réécriture

Date : 2026-10-30. Branche `rewrite`. Code dans `apps/web/`. Document Grist utilisé : **DEV** (`<ID du document DEV>`).

## Ce que le prototype démontre

Une tranche complète, du navigateur à Grist, en TypeScript :

- connexion par e-mail et mot de passe, session signée dans un cookie `HttpOnly`, rôles résolus depuis Grist ;
- la page `beneficiaire-profil` du widget, reprise presque telle quelle, qui affiche et enregistre le profil ;
- dépôt, lecture et suppression du CV, entièrement côté serveur (plus de n8n, plus de proxy PHP, plus de jeton Grist dans le navigateur) ;
- politiques d'accès en code qui remplacent les règles d'accès (ACL) de Grist ;
- image Docker de production.

Vérifié par `scripts/smoke.ts` (31 contrôles), en développement et dans le conteneur : tous passent. 13 tests unitaires passent, le typage est propre, `npm audit` ne signale rien en production.

## Résultats mesurés

| Mesure | Résultat |
|---|---|
| Latence d'un appel Grist (médiane) | 65 à 130 ms |
| Lecture de toutes les fiches `Beneficiaires` | 206 ms, 275 lignes, 1,2 Mo (4,4 Ko par ligne) |
| Résolution des rôles : 3 requêtes SQL en série / en parallèle | 344 ms / 107 ms |
| Connexion avant / après parallélisation | 1,9 s / 0,35 s |
| Image Docker | 234 Mo, utilisateur non root |

## Reprise du code des pages

- `ComboBox` et `helpers` : repris sans modification.
- `beneficiaire-profil` : 816 lignes, cinq endroits adaptés (journal de la session retiré, lecture ciblée de la fiche, upload, lien de lecture du CV, suppression du CV). Le reste est identique.
- Le script `port-page.mjs` automatise l'enveloppe. Un objet `gristAPI` côté navigateur (getData, updateRecord, getAuth, getComponent…) passe par les routes du serveur : c'est une couche de transition, pas la cible finale.

## Constats utiles pour la suite

1. **Upload vers Grist depuis Node** : le `FormData` de Node (undici) n'ajoute pas le saut de ligne qui suit la dernière frontière multipart. Grist répond alors 500, alors que curl passe. Le client construit donc le corps multipart lui-même (testé).
2. **Poids des lignes** : 4,4 Ko par fiche à cause des colonnes de formule. L'API `records` ne permet pas de choisir les colonnes. Pour les listes et annuaires, utiliser le point d'accès SQL avec une liste de colonnes explicite.
3. **Colonnes internes** : `Beneficiaires` contient `Clef_secrete`, `Commentaire` et `Missions_proposees`. Le widget les recevait. Le serveur ne les renvoie plus.
4. **Coordonnées** : masquées côté serveur quand la personne n'a pas consenti au contact, plus seulement dans l'interface.
5. **HTML invalide** dans la page d'origine (`<h3>`, `<div>`, `<p>` dans un `<p>`), invisible dans le widget : corrigé dans la copie.
6. **Pas de géocodage ni d'envoi de mails** dans cette tranche.
7. **Next.js** : la version 16.4.3 n'a plus de vulnérabilité connue en production, la 15.5 en avait une via PostCSS. Zod 4 pour la même raison.

## Limites du prototype

- Sessions sans état : pas de révocation avant expiration (24 h).
- Limiteur de tentatives en mémoire : valable pour une seule instance.
- Seule la table `Beneficiaires` et les référentiels ont une politique. Les autres tables sont refusées par défaut.
- Un seul rôle est porté (bénéficiaire). Les règles des acheteurs et répondants restent à écrire, en partant des règles d'accès de Grist.
- Le prototype n'a pas été testé depuis une adresse Scaleway : l'instance Grist est derrière un pare-feu qui a déjà bloqué une écriture lors de ce projet. Il faut convenir avec l'équipe qui l'héberge d'une autorisation pour l'adresse du serveur. Un essai de diagnostic avec des chaînes `User-Agent` variées a été refusé par l'environnement ; il n'a pas été poursuivi, la cause réelle de l'échec était le format multipart.
- Des données de test existent dans DEV : un bénéficiaire (id 309) et son compte `proto.rewrite@oriatec.fr`, ainsi que quelques pièces jointes orphelines nettoyées par Grist.

## Propositions pour la suite

1. Porter une page de liste et de recherche (`acheteur-annuaire`) pour valider les politiques d'un second rôle et le passage par SQL.
2. Écrire le module de mails (gabarits typés, fonction unique pour décrire un marché avec ou sans lot, table d'envois dans Grist pour l'idempotence).
3. Porter le parcours de déclaration des bénéficiaires, le plus riche en règles.
4. Demander l'autorisation du pare-feu pour l'adresse de sortie du serveur Scaleway avant d'engager le reste.
