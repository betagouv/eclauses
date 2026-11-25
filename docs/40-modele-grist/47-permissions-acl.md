# Permissions et ACL

Les ACL Grist sont la barrière de sécurité principale.

## Principes

- Le widget ne doit pas exposer des données que les ACL ne devraient pas permettre.
- Les pages filtrent pour l'ergonomie, mais Grist doit filtrer pour la sécurité.
- Les workflows n8n doivent être considérés comme privilégiés et doivent valider leurs entrées.

## AuthLink

La table `AuthLink` doit être configurée pour qu'un utilisateur ne voie que sa propre ligne de session.

Le runtime attend exactement une ligne visible. Si plusieurs lignes sont visibles, la session est refusée.

Le jeton est lisible par son titulaire : la règle sur les colonnes d'`AuthLink` exige `user.LinkKey.Token == rec.Token`. Le widget lit `getAuth().token` pour authentifier ses appels à n8n (liaison du CV). Pour cela, la colonne `Token` doit figurer dans la liste des colonnes lisibles de cette règle (`Roles, Acheteur, Beneficiaire, Repondant, Email` au 2026-10-30, sans `Token`) : à vérifier.

## Colonne `Beneficiaires.curriculum_vitae`

Les règles de colonne passent avant celles de la table. Une règle de lecture trop large sur la colonne contourne donc les règles de consentement de `Beneficiaires`.

Règles en PROD au 2026-10-30, dans l'ordre :

1. le bénéficiaire connecté est la ligne : lecture et modification ;
2. propriétaire : lecture et modification ;
3. lecteur : lecture ;
4. utilisateur connecté et la personne consent à figurer dans l'annuaire : lecture.

Avant le 2026-10-30, la dernière règle ne vérifiait pas le consentement (tout utilisateur connecté lisait tous les CV) et la première n'existait pas.

## Pièces jointes

Grist applique un contrôle propre aux pièces jointes, en plus des règles de cellule :

- pour **écrire** l'identifiant d'une pièce jointe dans une cellule, l'utilisateur doit l'avoir téléversée avec la même session, ou une cellule qu'il peut lire doit déjà la contenir ;
- pour la **télécharger**, il doit pouvoir lire une cellule qui la référence ;
- les propriétaires du document en sont dispensés.

Les bénéficiaires n'étant pas propriétaires, la liaison d'un CV neuf passe par n8n (voir [48-pieces-jointes-et-cv.md](48-pieces-jointes-et-cv.md)).

Le jeton `getAccessToken` du widget ne contient que `readOnly`, `userId` et `docId`, sans paramètres de lien. Les règles qui dépendent de `user.Auth` ou de `user.LinkKey` ne s'appliquent pas aux requêtes faites avec ce jeton.

## Accès au document

Le document PROD est ouvert en éditeur à « Tout le monde ». Les règles d'accès décrites ici sont donc la seule barrière : la règle par défaut refuse tout aux éditeurs et aux lecteurs, puis chaque table ouvre ce qui est nécessaire.

## Rôles

Les rôles sont portés par `AuthLink.Roles` et filtrés par le runtime.

Les pages doivent vérifier les rôles avec `gristAPI.getAuth()` et ne pas se baser uniquement sur l'affichage de navigation.

## Production

En production :

- aucune suppression sans accord explicite ;
- aucune modification de structure sans validation ;
- inspection read-only autorisée ;
- toute migration doit être tracée.

