# Rôle du front `index.html`

Le fichier [index.html](../../index.html) est le point d'entrée public du service. Il ne rend pas directement les pages Eclauses : il encapsule une page Grist dans une iframe.

## Responsabilités

- Charger l'iframe Grist depuis l'attribut `data-src`.
- Transmettre uniquement les paramètres autorisés au document Grist.
- Stocker le token `Token_` dans un cookie de courte durée.
- Nettoyer `Token_` de l'URL visible après lecture.
- Ajouter `style=singlePage` pour simplifier l'affichage Grist.
- Ajuster le recadrage vertical selon la taille d'écran.
- Autoriser le presse-papiers via `allow="clipboard-read; clipboard-write"`.

## Pourquoi une iframe

Le document Grist héberge le widget et applique les permissions. L'iframe permet de présenter l'application comme une page publique dédiée tout en conservant l'exécution dans le contexte Grist.

## Limites

Le wrapper n'est pas une couche de sécurité. Il masque et transmet des paramètres, mais l'accès réel doit être contrôlé par :

- les ACL Grist ;
- la table `AuthLink` ;
- les règles métier dans les pages ;
- les workflows serveur quand ils écrivent dans Grist.

