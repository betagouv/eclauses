# Workflows comptes et authentification

## Création de compte

Les workflows de création doivent :

1. normaliser l'email en minuscule ;
2. vérifier l'existence éventuelle d'un compte ;
3. créer ou réutiliser la ligne métier ;
4. créer le lien d'activation ;
5. créer ou mettre à jour `AuthLink` ;
6. envoyer l'email d'activation.

## Création en masse

Le workflow de création en masse doit traiter chaque ligne indépendamment :

- validation ;
- création ;
- email ;
- rapport d'erreurs.

Un échec sur une ligne ne doit pas bloquer tout le lot si la logique métier le permet.

## Reset password

Le reset utilise `Application_Password_Reset` et une URL n8n depuis `Application_Env.N8N_RESET_URL`.

Le formulaire de choix de mot de passe demande l'acceptation des CGU uniquement lors de la création de compte.

