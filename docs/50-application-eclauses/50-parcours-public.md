# Parcours public

Les pages publiques sont accessibles sans session valide, sous réserve de leur configuration `requires_auth`.

## Pages principales

| Page | Fichier local | Rôle |
|---|---|---|
| Accueil | [home](../../grist/page/home) | Présentation publique et accès aux espaces. |
| Connexion | [login](../../grist/page/login) | Demande de lien ou connexion selon configuration. |
| Mot de passe oublié | [mot-de-passe-oublie](../../grist/page/mot-de-passe-oublie) | Déclenchement reset. |
| Reset password | [reset-password](../../grist/page/reset-password) | Choix du mot de passe et acceptation CGU lors de la création. |
| Centre d'aide | [support](../../grist/page/support) | FAQ et vidéos. |
| Contact support | [support-contact](../../grist/page/support-contact) | Formulaire de contact dédié. |
| Mentions légales | [mentions-legales](../../grist/page/mentions-legales) | Page légale. |
| Données personnelles | [donnees-personnelles](../../grist/page/donnees-personnelles) | Page RGPD. |
| Accessibilité | [accessibilite](../../grist/page/accessibilite) | Déclaration d'accessibilité. |
| CGU | [cgu](../../grist/page/cgu) | Conditions générales d'utilisation. |

## Contact support

Le lien "contacter le support pour demander la création de mon compte Eclauses" doit ouvrir directement la page de formulaire de contact, pas seulement le centre d'aide.

Le formulaire conserve les retours à la ligne via un champ HTML ou une transformation `message_html` côté webhook.

## Centre d'aide

Les vidéos ne doivent pas se lancer automatiquement. La page support doit privilégier une consultation explicite par l'utilisateur.

