# Architecture globale

Eclauses est une application métier construite autour d'un document Grist utilisé comme base de données, CMS de composants et support d'authentification. L'interface utilisateur est servie par un custom widget DSFR React chargé dans une iframe Grist, elle-même encapsulée par un front public minimal.

## Couches du système

```text
Navigateur utilisateur
  -> index.html public
    -> iframe vers une page Grist
      -> custom widget grist-dsfr-react-app/widget-app.html
        -> runtime grist-dsfr-react-app/widget-app.js
          -> pages React stockées dans Application_Composants
          -> tables métier Grist
          -> webhooks n8n pour emails et traitements asynchrones
```

Le front public [index.html](../../index.html) ne contient pas l'application métier. Il prépare l'URL de l'iframe, transmet les paramètres autorisés, stocke le token de session dans un cookie et ajuste l'affichage de l'iframe.

Le widget [widget-app.html](../../grist-dsfr-react-app/widget-app.html) fournit la structure DSFR : header, menu, zone principale, loader et footer.

Le runtime [widget-app.js](../../grist-dsfr-react-app/widget-app.js) initialise Grist, charge la session, lit les composants dans `Application_Composants`, compile le JSX avec Babel et rend les pages React.

Les pages métier sont versionnées localement dans [grist/page](../../grist/page). Les composants partagés sont versionnés dans [grist/composants](../../grist/composants).

## Responsabilités par couche

| Couche | Responsabilités |
|---|---|
| `index.html` | Encapsulation iframe, propagation de `Token_`, `page_`, `marche_`, cookie session, recadrage visuel. |
| `widget-app.html` | Shell DSFR, chargement des scripts externes, conteneurs HTML. |
| `widget-app.js` | Authentification, navigation, chargement des composants, API exposée aux pages, rendu React. |
| `Application_Composants` | CMS de pages et composants React exécutés par le widget. |
| Tables métier Grist | Données applicatives, référentiels, ACL, pièces jointes. |
| n8n | Création/activation de comptes, emails, relances, archivage, traitements planifiés. |
| Fichiers locaux | Source de vérité de développement pour pages, composants et documentation. |

## Principe central

Grist reste la source de données et le point d'application des ACL. Le widget ne doit pas être considéré comme une barrière de sécurité suffisante : les règles d'accès doivent être portées par Grist et par les workflows serveur quand ils écrivent dans Grist.

## État DEV/PROD

La documentation actuelle décrit le système cible tel qu'il existe dans le code local et les modifications DEV récentes. Plusieurs éléments peuvent ne pas être encore déployés en PROD :

- modèle `Marches` parent/enfant ;
- pages dédiées de déclaration, modification et détail marché ;
- inscription candidat multi-lots ;
- refus de déclaration bénéficiaire ;
- colonnes `Eligible` et `Doit_supprimer` ;
- upload CV direct vers Grist depuis le widget, avec liaison par n8n (déployé en PROD) ;
- page `support-contact` ;
- page `cgu` ;
- workflows n8n adaptés au modèle multi-lots.

Avant toute documentation de production, confirmer le schéma et les composants actifs via le MCP Grist en lecture seule.

