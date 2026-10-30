# Règles production

## Interdictions par défaut

En production, ne jamais supprimer :

- données ;
- tables ;
- colonnes ;
- attachments ;
- pages ;
- composants ;
- webhooks ;
- workflows ;
- comptes.

## Validation obligatoire

Toute action d'écriture en production doit être validée explicitement par l'utilisateur dans la conversation courante.

Sont considérées comme écritures :

- création ;
- modification ;
- import ;
- activation/désactivation ;
- changement de formule ;
- changement ACL ;
- changement de workflow ;
- déploiement de composant ;
- modification `Application_Env`.

## Inspection autorisée

Les actions read-only sont autorisées :

- lister les tables ;
- exporter un schéma ;
- lire les composants ;
- comparer DEV/PROD ;
- lire les ACL ;
- lire les workflows exportés localement.

## Environnement ambigu

Si un document, webhook ou endpoint n'a pas de marqueur clair `dev`, `test` ou `staging`, le traiter comme production.

