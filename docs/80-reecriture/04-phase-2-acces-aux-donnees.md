# Phase 2 : couche d'accès aux données sur PostgreSQL

Branche `rewrite-postgres`. L'application ne lit et n'écrit plus dans Grist : tout passe par PostgreSQL. Grist n'est conservé que comme source du futur import (phase 6).

## Ce qui a été fait

- **Comptes et jetons** (`services/comptes.ts`) : un seul compte par e-mail (insensible à la casse), créé sans mot de passe tant qu'il n'est pas activé. Les liens d'activation (30 jours) et de réinitialisation (24 h) sont des jetons aléatoires dont seule l'empreinte est stockée, à usage unique (consommation atomique), un seul actif par compte et par objectif. Remplace `AuthLink`, `Application_AuthUser` et `Application_Password_Reset`.
- **Identité** (`auth/identity.ts`) : rôles déduits en SQL (bénéficiaire éligible et non à détruire, répondant non à détruire, utilisateur acheteur).
- **Compatibilité avec les pages** (`compat/`) : chaque table est décrite une fois (nom d'origine → colonne) ; la lecture produit la forme attendue (listes d'identifiants, dates en secondes, statuts en libellés), l'écriture refuse tout champ inconnu, calculé ou non autorisé. Les formules de Grist sont réimplémentées : agrégats de lots et statut global, intitulés, libellés de lot, candidats, bénéficiaires d'un marché (= ses déclarations), `Eligible`, `Doit_supprimer`, `Doit_archiver`, libellé de répondant, clauses avec bénéficiaires actifs, adresses d'envoi.
- **Droits** (`policies/`, `tables.ts`) : mêmes règles qu'avant, réécrites sur les nouvelles tables. Refus par défaut.
- **Notifications** (`services/notifications.ts`, `services/envois.ts`) : les courriers partent des opérations métier (plus de webhooks). La mémoire des envois est en base (`notifications_envoyees`), réservée de façon atomique : deux traitements simultanés n'envoient qu'une fois, et un redémarrage ne provoque plus de doublon. Une erreur d'envoi est journalisée sans faire échouer l'opération.
- **Fichiers** (`storage/`, `services/fichiers.ts`) : interface `FileStore` et pilote local (clés opaques, écriture atomique, sortie du dossier refusée). Le CV est une ligne `fichiers` ; remplacer ou retirer un CV supprime l'ancien fichier. Le téléchargement passe par le serveur, après contrôle des droits.
- **Tâches** (`jobs.ts`) : réécrites en SQL (`purge-resets`, `purge-sessions`, `anonymise-beneficiaires`, `anonymise-repondants`, `delete-ineligible-accounts`, `archive-marches`, `invitations-comptes`).
- **Contenu du site** (`site.ts`) : en-tête et pied de page lus dans `parametres` et `liens`.
- **Indicateurs d'impact** (`services/indicateurs.ts`) : les extraits Python de `Valeur_automatique` deviennent des indicateurs calculés en SQL, désignés par un code.
- **Supprimés** : routes de webhooks Grist, gestionnaires d'événements, mémoire en processus, `gen-schema`, types générés, scripts de test visant Grist.

## Corrections de modèle faites en route

- `Marches.Beneficiaires` listait des **déclarations**, pas des bénéficiaires (vérifié sur le DEV : strictement l'inverse de `Declarations.Marche`). La table `marche_beneficiaires` est retirée (migration `0001`).
- `Impacts.Valeur_automatique` contenait du code Python : colonne remplacée par `indicateur` (migration `0002`).
- Les pages lisaient les colonnes d'affichage internes de Grist (`gristHelper_Display2..5`) : elles lisent maintenant `Formation_Libelle`, `Specialite_Libelles`, `Departement_Libelles`, `Region_Libelles`.
- Une consultation de coordonnées est unique par (répondant, marché, bénéficiaire) : un doublon est refusé et ne renvoie pas de courrier.
- Une page contenait un `<ul>` dans un `<p>` (erreur d'hydratation) : corrigé.

## Vérifié

- 72 tests passent : 20 de notifications (dont concurrence et jetons), 19 d'accès aux données et de droits, 9 de schéma, 5 de tâches, plus les tests existants. Ils tournent sur une base PostgreSQL jetable.
- `scripts/smoke.ts` : 40 contrôles HTTP de bout en bout (visiteur, bénéficiaire avec CV, acheteur, répondant, lien de réinitialisation, tâches) sur le vrai serveur.
- `next build` et `tsc` propres. Pages parcourues dans le navigateur par rôle : profil, annuaire, marchés (bénéficiaire) ; marchés, annuaire (acheteur).

## Pas encore fait ou à savoir

- **Sessions** : toujours des JWT de 24 h qui portent les identifiants. Une session créée avant le changement de base reste valide et pointe sur d'anciens identifiants ; les sessions révocables arrivent en phase 3.
- **Limiteur de débit** toujours en mémoire (phase 3).
- **Déclencheurs** : les courriers partent quand une page écrit. Un changement fait directement en base (ou plus tard depuis l'administration) devra appeler les mêmes fonctions de `services/notifications.ts`.
- **Pages non vérifiées une à une** : les 29 pages se chargent, seules celles listées ci-dessus ont été parcourues ; les parcours d'écriture complets passent par les tests d'intégration, pas par le navigateur.
- **Docker** : l'image ne lance pas encore les migrations et n'a pas de volume de fichiers (phase 8).
- **Données** : aucune donnée de Grist n'est importée (phase 6).
