# Cartographie des sources techniques

Ce fichier liste les sources à utiliser pour rédiger et maintenir la documentation.

## Front public

| Source | Rôle |
|---|---|
| [index.html](../index.html) | Page publique qui encapsule l'iframe Grist, gère `Token_`, `page_`, `marche_`, le cookie et les offsets d'affichage. |
| [favicon/](../favicon) | Favicons et manifest public. |
| [logo.png](../logo.png) | Logo utilisé dans les emails et certaines pages. |

## Widget Grist DSFR

| Source | Rôle |
|---|---|
| [grist-dsfr-react-app/widget-app.html](../grist-dsfr-react-app/widget-app.html) | Shell HTML DSFR exécuté dans le widget Grist. |
| [grist-dsfr-react-app/widget-app.js](../grist-dsfr-react-app/widget-app.js) | Runtime principal `ReactApp`. |
| [grist-dsfr-react-app/README.md](../grist-dsfr-react-app/README.md) | Notes initiales du widget. |
| [grist-dsfr-react-app/docs](../grist-dsfr-react-app/docs) | Documentation existante à reprendre et corriger. |
| [grist-dsfr-react-app/tools/grist_sync.py](../grist-dsfr-react-app/tools/grist_sync.py) | Outil local de synchronisation avec Grist à documenter si encore utilisé. |
| [grist-dsfr-react-app/tools/grist_sync.config.json](../grist-dsfr-react-app/tools/grist_sync.config.json) | Configuration de sync à vérifier. |

## Composants partagés

| Source | Rôle |
|---|---|
| [grist/composants/helpers](../grist/composants/helpers) | Helpers partagés exposables aux pages. |
| [grist/composants/ComboBox](../grist/composants/ComboBox) | Composant partagé de sélection, tri alphabétique, multisélection et tooltip DSFR. |

## Pages publiques

| Source | Rôle |
|---|---|
| [grist/page/home](../grist/page/home) | Accueil public. |
| [grist/page/login](../grist/page/login) | Connexion. |
| [grist/page/mot-de-passe-oublie](../grist/page/mot-de-passe-oublie) | Demande de réinitialisation. |
| [grist/page/reset-password](../grist/page/reset-password) | Choix du mot de passe et acceptation CGU à la création. |
| [grist/page/support](../grist/page/support) | Centre d'aide. |
| [grist/page/support-contact](../grist/page/support-contact) | Formulaire de contact dédié. |
| [grist/page/mentions-legales](../grist/page/mentions-legales) | Mentions légales. |
| [grist/page/donnees-personnelles](../grist/page/donnees-personnelles) | Données personnelles. |
| [grist/page/accessibilite](../grist/page/accessibilite) | Accessibilité. |
| [grist/page/cgu](../grist/page/cgu) | Conditions générales d'utilisation. |

## Pages acheteur

| Source | Rôle |
|---|---|
| [grist/page/acheteur-home](../grist/page/acheteur-home) | Accueil acheteur et bandeaux d'alerte. |
| [grist/page/acheteur-marches](../grist/page/acheteur-marches) | Liste des marchés par onglets, préparation, consultation, exécution. |
| [grist/page/acheteur-marches-declaration](../grist/page/acheteur-marches-declaration) | Création d'un marché parent et de lots éventuels. |
| [grist/page/acheteur-marches-modification](../grist/page/acheteur-marches-modification) | Modification d'un marché en préparation et de ses lots. |
| [grist/page/acheteur-marches-detail](../grist/page/acheteur-marches-detail) | Vue détail/gestion marché, titulaires, relances, validation/refus. |
| [grist/page/acheteur-annuaire](../grist/page/acheteur-annuaire) | Annuaire bénéficiaires vu par acheteur. |
| [grist/page/acheteur-statistiques](../grist/page/acheteur-statistiques) | Statistiques acheteur. |
| [grist/page/acheteur-infos](../grist/page/acheteur-infos) | Informations acheteur. |
| [grist/page/espace-acheteur](../grist/page/espace-acheteur) | Page ou wrapper d'espace acheteur. |

## Pages répondant / candidat / titulaire

| Source | Rôle |
|---|---|
| [grist/page/repondant-home](../grist/page/repondant-home) | Accueil répondant. |
| [grist/page/repondant-marches](../grist/page/repondant-marches) | Marchés candidat/titulaire, déclaration bénéficiaires par lot. |
| [grist/page/repondant-recherches](../grist/page/repondant-recherches) | Recherche annuaire bénéficiaires et lots actifs. |
| [grist/page/repondant-infos](../grist/page/repondant-infos) | Informations répondant. |
| [grist/page/inscription-candidat](../grist/page/inscription-candidat) | Inscription candidat via lien marché parent, sélection lots. |
| [grist/page/espace-repondant](../grist/page/espace-repondant) | Page ou wrapper d'espace répondant. |

## Pages bénéficiaire

| Source | Rôle |
|---|---|
| [grist/page/beneficiaire-home](../grist/page/beneficiaire-home) | Accueil bénéficiaire. |
| [grist/page/beneficiaire-profil](../grist/page/beneficiaire-profil) | Profil bénéficiaire, upload CV direct vers Grist et liaison par webhook n8n. |
| [grist/page/beneficiaire-annuaire](../grist/page/beneficiaire-annuaire) | Annuaire côté bénéficiaire. |
| [grist/page/beneficiaire-marches](../grist/page/beneficiaire-marches) | Lots/marchés actifs côté bénéficiaire. |
| [grist/page/espace-beneficiaire](../grist/page/espace-beneficiaire) | Page ou wrapper d'espace bénéficiaire. |

## n8n et déploiement

| Source | Rôle |
|---|---|
| [n8n/DEV - Eclauses.json](../n8n/DEV%20-%20Eclauses.json) | Export actuel DEV à analyser. |
| [n8n/Eclauses - PROD.json](../n8n/Eclauses%20-%20PROD.json) | Export actuel PROD à analyser. |
| [deploiement/todo-deploiement-dev-prod.md](../deploiement/todo-deploiement-dev-prod.md) | Checklist de migration déjà préparée. |
| `n8n/PROD - Eclauses - corrige mails.json` | Export PROD avec le flux de liaison de CV (`cv/lier`) et les correctifs de mails pour les marchés sans lot (à déployer). |
| `n8n/eclauses-lier-cv-PROD.json` | Workflow de liaison de CV seul, remplacé par l'export complet ci-dessus. |
| [deploiement/correctifs-mails-sans-lot.md](../deploiement/correctifs-mails-sans-lot.md) | Formules, colonnes et webhooks Grist à créer pour les mails des marchés sans lot. |

L'ancien proxy `api/upload_cv.php` a été supprimé le 2026-10-30 (voir [48-pieces-jointes-et-cv.md](40-modele-grist/48-pieces-jointes-et-cv.md)).

## Structure Grist

| Source | Rôle |
|---|---|
| `MCP Grist` | Source recommandée pour confirmer le schéma réel DEV/PROD en lecture seule. |
| `Application_Composants` | Source runtime des pages et composants. |
| `Application_Env` | Variables d'environnement consommées par les pages. |
| `AuthLink` | Authentification et rôles. |
| `Marches` | Marchés parents et lots enfants dans la même table en DEV/cible. |
| `Declarations_Beneficiaires` | Déclarations par lot ou par marché non alloti. |
| `Declarations_Beneficiaires_Refus` | Refus de déclaration et motifs. |
| `Beneficiaires` | Profils, éligibilité, suppression logique, annuaire. |
| `Repondants` | Candidats/titulaires, suppression logique. |

## Zones DEV non forcément déployées en PROD

Les éléments suivants doivent être annotés avec leur état DEV/PROD lors de la rédaction finale :

- modèle `Marches` parent/enfant ;
- pages `acheteur-marches-declaration`, `acheteur-marches-modification`, `acheteur-marches-detail` ;
- inscription candidat multi-lots ;
- refus de déclaration bénéficiaire ;
- colonnes `Eligible` et `Doit_supprimer` ;
- upload CV direct vers Grist depuis le widget, avec liaison par n8n (déployé en PROD le 2026-10-30) ;
- page `support-contact` ;
- page `cgu` ;
- workflows n8n adaptés au multi-lots et aux règles de conservation.

