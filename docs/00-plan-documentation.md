# Plan de documentation technique

## Objectif

Produire une documentation technique complète, précise et maintenable du système Eclauses : architecture, fonctionnement runtime, modèle de données, composants Grist, parcours métier, intégrations n8n, déploiement et maintenance.

La documentation doit permettre à un développeur ou à un mainteneur de comprendre :

- comment le site public encapsule Grist ;
- comment le widget DSFR charge et exécute les pages React ;
- comment les tables `Application_*` pilotent l'interface ;
- comment l'authentification et les rôles sont résolus ;
- comment les parcours Eclauses fonctionnent côté acheteur, candidat, titulaire/répondant et bénéficiaire ;
- quelles différences DEV/PROD sont attendues pendant la migration.

## Arborescence cible

```text
docs/
  README.md
  00-plan-documentation.md
  01-cartographie-sources.md
  02-registre-schemas.md

  10-vue-ensemble/
    10-architecture-globale.md
    11-environnements-dev-prod.md
    12-glossaire-metier-technique.md

  20-front-index/
    20-role-index-html.md
    21-parametres-url.md
    22-iframe-grist-et-affichage.md
    23-cookies-session-token.md

  30-widget-grist-dsfr/
    30-architecture-widget.md
    31-widget-app-html.md
    32-reactapp-runtime.md
    33-chargement-composants.md
    34-navigation-et-espaces.md
    35-authentification-authlink.md
    36-gristapi.md
    37-composants-partages.md
    38-gestion-erreurs-debug.md

  40-modele-grist/
    40-vue-ensemble-tables.md
    41-tables-application.md
    42-authlink-et-comptes.md
    43-marches-parent-enfant.md
    44-beneficiaires.md
    45-repondants-candidatures-titulaires.md
    46-declarations-beneficiaires.md
    47-permissions-acl.md
    48-pieces-jointes-et-cv.md

  50-application-eclauses/
    50-parcours-public.md
    51-espace-beneficiaire.md
    52-espace-candidat-titulaire.md
    53-espace-acheteur.md
    54-annuaire-et-recherche.md
    55-marches-multi-lots.md
    56-validation-refus-declaration.md
    57-archivage-et-suppression-donnees.md

  60-automatisations-n8n/
    60-vue-ensemble.md
    61-authentification-et-comptes.md
    62-notifications-marches.md
    63-notifications-declarations.md
    64-relances-et-archivage.md
    65-contrats-d-entree-sortie.md

  70-deploiement-maintenance/
    70-synchronisation-application-composants.md
    71-checklist-deploiement-dev-prod.md
    72-tests-de-non-regression.md
    73-runbook-incidents.md
    74-regles-production.md

  diagrams/
    architecture-globale.excalidraw
    runtime-widget.excalidraw
    routage-index-iframe.excalidraw
    auth-et-roles.excalidraw
    modele-marches-parent-enfant.excalidraw
    parcours-publication-multilots.excalidraw
    parcours-declaration-validation-refus.excalidraw
    flux-n8n-emails.excalidraw
```

## Section 10 - Vue d'ensemble

### `10-architecture-globale.md`

Décrire les couches :

- navigateur ;
- front public `index.html` ;
- iframe Grist ;
- widget `grist-dsfr-react-app/widget-app.html` ;
- runtime `ReactApp` dans `widget-app.js` ;
- tables Grist ;
- pages React stockées dans `Application_Composants` ;
- automatisations n8n ;
- fichiers locaux utilisés pour versionner les pages.

Inclure un schéma Excalidraw `architecture-globale.excalidraw`.

### `11-environnements-dev-prod.md`

Documenter :

- documents Grist DEV et PROD connus ;
- exports n8n DEV/PROD ;
- différences attendues : document ID, URLs `eclauses-dev`/`eclauses`, chemins webhooks ;
- règle de sécurité : aucune modification PROD sans validation explicite ;
- état cible quand une fonctionnalité existe en DEV mais pas encore en PROD.

### `12-glossaire-metier-technique.md`

Définir les termes :

- bénéficiaire ;
- candidat ;
- répondant ;
- titulaire ;
- acheteur ;
- marché parent ;
- lot enfant ;
- clause sociale ;
- déclaration bénéficiaire ;
- refus de déclaration ;
- composant, page, shared component, child component ;
- token, AuthLink, espace actif.

## Section 20 - Front `index.html`

### `20-role-index-html.md`

Expliquer le rôle du fichier racine [index.html](../index.html) :

- page publique exposée au navigateur ;
- iframe vers Grist ;
- isolation du document Grist ;
- ajout de `style=singlePage` ;
- gestion du viewport et du recadrage.

### `21-parametres-url.md`

Documenter les paramètres :

- `Token_` : récupéré depuis l'URL, stocké en cookie, retiré de l'URL par `replaceState`, puis transmis à l'iframe ;
- `page_` : page à charger dans le widget ;
- `marche_` : marché à transmettre au parcours d'inscription ou de détail ;
- `style=singlePage` : ajouté au chargement Grist ;
- compatibilité côté widget avec `p`, `page`, `page_`.

### `22-iframe-grist-et-affichage.md`

Décrire :

- `data-src` de l'iframe ;
- `allow="clipboard-read; clipboard-write"` ;
- `.frame-wrap` ;
- `--offset-x`, `--offset-y`, `--zoom` ;
- configuration responsive `CONFIG` ;
- raison du recadrage sans `transform` pour préserver les popovers.

### `23-cookies-session-token.md`

Documenter :

- cookie `Token_`, durée 7 jours ;
- nettoyage à la déconnexion dans `widget-app.js` ;
- limites de sécurité : le cookie ne remplace pas les ACL Grist ;
- comportement attendu en navigation directe, refresh, logout.

## Section 30 - Widget Grist DSFR React

Cette section reprend et améliore la documentation existante de [grist-dsfr-react-app/docs](../grist-dsfr-react-app/docs).

### `30-architecture-widget.md`

Actualiser [01-architecture.md](../grist-dsfr-react-app/docs/01-architecture.md) :

- DSFR 1.14.1 ;
- React 18 en UMD ;
- Babel Standalone ;
- Grist Plugin API ;
- chargement en iframe ;
- distinction pages vs composants partagés.

### `31-widget-app-html.md`

Documenter [widget-app.html](../grist-dsfr-react-app/widget-app.html) :

- structure DSFR du header ;
- conteneur `#main-content` ;
- loader `#loading` ;
- footer dynamique ;
- scripts externes et ordre de chargement.

### `32-reactapp-runtime.md`

Actualiser [02-reactapp-class.md](../grist-dsfr-react-app/docs/02-reactapp-class.md) avec le code réel :

- `COMPONENTS_TABLE = Application_Composants` ;
- `AUTH_TABLE = AuthLink` ;
- `HEADER_TABLE`, `FOOTER_TABLE`, `LINKS_TABLE` ;
- `session.auth`, `session.activeSpace`, `env`, `debugEnabled` ;
- `getBabelTransformOptions()` et plugins réellement supportés ;
- `getComponentRequire()` et support `react/jsx-runtime`.

### `33-chargement-composants.md`

Actualiser [03-component-lifecycle.md](../grist-dsfr-react-app/docs/03-component-lifecycle.md) :

- chargement complet de `Application_Composants` ;
- `template_id`, `template_name`, `component_type`, `component_code` ;
- page si `component_type` différent de `component` ;
- shared component si `component_type = component` ;
- `sanitizeCode()` ;
- transformation Babel ;
- `new Function()` ;
- rendu par `ReactDOM.createRoot`.

### `34-navigation-et-espaces.md`

Décrire :

- `data-nav` ;
- `window.gristNavigate` ;
- `gristAPI.navigate()` ;
- espace actif multi-rôle ;
- priorité de rôle `beneficiaire`, `acheteur`, `repondant` ;
- `localStorage.activeSpace` ;
- menu connecté et menu mobile ;
- ancres via `data-anchor` et `scrollToAnchor()`.

### `35-authentification-authlink.md`

Actualiser [12-authlink.md](../grist-dsfr-react-app/docs/12-authlink.md) :

- lecture d'une seule ligne `AuthLink` visible par ACL ;
- colonnes réellement utilisées : `Email`, `Token`, `Expire_le`, `Beneficiaire`, `Repondant`, `Acheteur`, `Roles` ;
- filtrage des rôles si `Beneficiaires.Eligible` faux ou `Doit_supprimer` vrai ;
- filtrage des répondants si `Repondants.Doit_supprimer` vrai ;
- comportement sans rôle valide.

### `36-gristapi.md`

Actualiser [21-gristapi-object.md](../grist-dsfr-react-app/docs/21-gristapi-object.md) :

- `getAuth()` ;
- `isAuthenticated()` ;
- `refreshAuth()` ;
- `goToLanding()` ;
- `goToDefault()` ;
- `getSelection()`, `onRecord()`, `onRecords()` ;
- `getQueryParams()` ;
- `getComponent()` ;
- `getEnv()` ;
- `getChildComponent()` ;
- `createChildComponent()` ;
- `helpers` ;
- `getData()`, `addRecord()`, `updateRecord()`, `deleteRecord()`.

### `37-composants-partages.md`

Actualiser [72-shared-components.md](../grist-dsfr-react-app/docs/72-shared-components.md) :

- composant `helpers` ;
- composant `ComboBox` ;
- options triées par label ;
- `tooltip` DSFR sur les options ;
- conventions d'export `module.exports` ou `Component`.

### `38-gestion-erreurs-debug.md`

Documenter :

- `showError()` ;
- `showComponentError()` ;
- `Application_Env.DEBUG` ;
- erreurs Babel courantes : plugin absent, import non supporté, composant non défini ;
- méthode de diagnostic avec `template_id`.

## Section 40 - Modèle Grist

### `40-vue-ensemble-tables.md`

Lister les tables par domaine :

- tables application ;
- tables auth ;
- tables acteurs ;
- tables marchés ;
- tables déclarations ;
- tables référentiels ;
- tables support ;
- tables temporaires ou de migration.

Préciser que la source fiable doit être confirmée via le MCP Grist ou export schema avant finalisation.

### `41-tables-application.md`

Documenter :

- `Application_Composants` ;
- `Application_Env` ;
- `Application_Header` ;
- `Application_Footer` ;
- `Application_Liens` ;
- `Application_FAQ_Categories` ;
- `Application_FAQ_Questions` ;
- pages légales.

### `42-authlink-et-comptes.md`

Documenter :

- liaison `AuthLink` vers acteurs métier ;
- activation de compte ;
- reset password ;
- acceptation CGU à la création ;
- règles `Eligible` et `Doit_supprimer` ;
- suppression logique des données personnelles.

### `43-marches-parent-enfant.md`

Documenter la structure DEV/cible :

- table unique `Marches` ;
- ligne parent si `Marche_parent` vide ;
- ligne lot si `Marche_parent` référence un parent ;
- liste inverse `Lots` ;
- publication et lien candidat au niveau parent ;
- titulaire, déclaration bénéficiaires, relance et validation au niveau lot ;
- cas non alloti : pas de lot enfant, les infos restent sur la ligne parent ;
- statut global calculé ou affiché depuis les lots.

Inclure `modele-marches-parent-enfant.excalidraw`.

### `44-beneficiaires.md`

Documenter :

- colonnes annuaire ;
- `Eligible` ;
- `Doit_supprimer` ;
- consentement contact groupement ;
- CV et attachments ;
- règle d'affichage des coordonnées ;
- impact sur statistiques publiques.

### `45-repondants-candidatures-titulaires.md`

Documenter :

- répondant candidat ;
- répondant titulaire ;
- inscription candidat multi-lots ;
- exclusion des lots déjà validés côté recherche ;
- suppression logique si `Doit_supprimer`.

### `46-declarations-beneficiaires.md`

Documenter :

- `Declarations_Beneficiaires` ;
- `Declarations_Beneficiaires_Refus` ;
- statuts `brouillon`, `validé` et statuts marché associés ;
- confirmations acheteur obligatoires ;
- refus avec motif obligatoire ;
- retour du lot en `En attente de déclaration des bénéficiaires`.

### `47-permissions-acl.md`

Documenter :

- principes ACL Grist ;
- lecture AuthLink limitée par token ;
- accès par rôle ;
- règles spécifiques bénéficiaire éligible ;
- règles de production : aucune suppression ou modification sans validation.

### `48-pieces-jointes-et-cv.md`

Documenter :

- upload direct Grist depuis widget avec `grist.docApi.getAccessToken({ readOnly: false })` ;
- endpoint `/attachments?auth=...` ;
- liaison de la pièce jointe à la ligne par le webhook n8n `cv/lier` (Grist refuse l'écriture depuis la session du widget) ;
- téléchargement via `/attachments/{id}/download?auth=...` ;
- format ref-list `['L', id]` ;
- prévisualisation PDF ;
- message DOC/DOCX non prévisualisable.

## Section 50 - Application Eclauses

### `50-parcours-public.md`

Décrire :

- home ;
- support ;
- contact support dédié ;
- login ;
- reset password ;
- pages légales.

### `51-espace-beneficiaire.md`

Documenter :

- home bénéficiaire ;
- profil ;
- CV ;
- annuaire/marchés actifs ;
- impact `Eligible`.

### `52-espace-candidat-titulaire.md`

Documenter :

- recherche de marchés/lots ;
- inscription candidat ;
- vue marchés candidat ;
- vue marchés titulaire ;
- déclaration bénéficiaires par lot ;
- ordre des statuts.

### `53-espace-acheteur.md`

Documenter :

- home acheteur ;
- déclaration d'un marché ;
- modification d'un marché ;
- préparation ;
- consultation et passation ;
- détail/gestion marché ;
- déclaration titulaire ;
- suivi exécution ;
- validation/refus de déclaration.

### `54-annuaire-et-recherche.md`

Documenter :

- annuaires acheteur, bénéficiaire, répondant ;
- filtres ;
- badges intérêt exprimé ;
- masquage coordonnées si refus contact groupement ;
- exclusion bénéficiaires non éligibles.

### `55-marches-multi-lots.md`

Documenter le parcours cible :

- création marché parent ;
- création lots ;
- lien candidat unique parent ;
- publication parent ;
- inscription candidat multi-lots ;
- titulaire par lot ;
- validation par lot ;
- passage parent en clause validée quand tous les lots sont validés.

### `56-validation-refus-declaration.md`

Documenter :

- contrôles avant validation ;
- bénéficiaire Eclauses vs bénéficiaire externe ;
- cases obligatoires ;
- bouton voir fiche uniquement pour bénéficiaire Eclauses ;
- refus avec motif ;
- message côté répondant.

### `57-archivage-et-suppression-donnees.md`

Documenter les règles :

- bénéficiaire non éligible 5 ans après diplomation + 6 mois de tampon ;
- conservation BO 5 ans après fin éligibilité ;
- suppression logique après 10 ans ;
- candidats 5 ans après dernière connexion ;
- titulaires 5 ans après validation clause sociale ;
- marché archivé 6 mois après date de fin d'exécution prévisionnelle.

## Section 60 - Automatisations n8n

### `60-vue-ensemble.md`

Cartographier les workflows locaux dans [n8n](../n8n) :

- DEV ;
- PROD ;
- différences attendues ;
- entrées/sorties ;
- webhooks.

### `61-authentification-et-comptes.md`

Documenter :

- création compte ;
- création compte en masse ;
- activation espace ;
- reset password ;
- emails associés.

### `62-notifications-marches.md`

Documenter :

- publication unique par marché parent ;
- liste HTML des lots ;
- notification candidats/bénéficiaires.

### `63-notifications-declarations.md`

Documenter :

- invitation titulaire par lot ;
- relance titulaire par lot ;
- déclaration à valider ;
- clause validée ;
- bénéficiaire déclaré.

### `64-relances-et-archivage.md`

Documenter :

- date dernière relance titulaire ;
- relances déclaration bénéficiaires si automatisées ;
- archivage marchés ;
- suppression logique données personnelles.

### `65-contrats-d-entree-sortie.md`

Pour chaque webhook :

- chemin ;
- environnement ;
- payload entrant ;
- tables lues ;
- tables écrites ;
- emails envoyés ;
- idempotence ;
- erreurs attendues.

## Section 70 - Déploiement et maintenance

### `70-synchronisation-application-composants.md`

Documenter :

- correspondance fichier local `grist/page/*` vers `Application_Composants.template_id` ;
- composants partagés `grist/composants/*` ;
- possibilités MCP ou script de sync ;
- règle : vérifier DEV avant PROD.

### `71-checklist-deploiement-dev-prod.md`

Reprendre [deploiement/todo-deploiement-dev-prod.md](../deploiement/todo-deploiement-dev-prod.md) :

- structure Grist ;
- permissions avancées ;
- pages ;
- variables `Application_Env` ;
- workflows n8n ;
- wrapper `index.html`.

### `72-tests-de-non-regression.md`

Lister les tests manuels :

- login ;
- changement d'espace ;
- inscription candidat ;
- marché non alloti ;
- marché alloti ;
- publication ;
- déclaration titulaire ;
- déclaration bénéficiaires ;
- validation/refus ;
- annuaires ;
- upload CV ;
- pages légales/support.

### `73-runbook-incidents.md`

Documenter :

- composant introuvable ;
- erreur Babel ;
- import non supporté ;
- upload CV cassé ;
- token invalide ;
- page inaccessible par rôle ;
- n8n webhook en erreur.

### `74-regles-production.md`

Rappeler :

- aucune modification PROD sans accord explicite ;
- pas de suppression de données en production ;
- inspection read-only autorisée ;
- toute migration doit être validée, traçable et réversible autant que possible.

## Reprise de la documentation existante

| Ancien fichier | Destination cible | Action |
|---|---|---|
| `grist-dsfr-react-app/docs/00-index.md` | `docs/README.md` et plan global | Remplacer l'index centré widget par l'index système complet. |
| `01-architecture.md` | `30-widget-grist-dsfr/30-architecture-widget.md` | Actualiser versions, runtime et flux. |
| `02-reactapp-class.md` | `30-widget-grist-dsfr/32-reactapp-runtime.md` | Réaligner avec `widget-app.js` actuel. |
| `03-component-lifecycle.md` | `30-widget-grist-dsfr/33-chargement-composants.md` | Réécrire avec `template_id/component_code/component_type`. |
| `11-application-composants.md` | `40-modele-grist/41-tables-application.md` | Corriger noms de colonnes et ajouter sync locale. |
| `12-authlink.md` | `30-widget-grist-dsfr/35-authentification-authlink.md` et `40-modele-grist/42-authlink-et-comptes.md` | Séparer runtime et modèle de données. |
| `21-gristapi-object.md` | `30-widget-grist-dsfr/36-gristapi.md` | Actualiser API exposée. |
| `72-shared-components.md` | `30-widget-grist-dsfr/37-composants-partages.md` | Ajouter `ComboBox`, `helpers`, tooltips, contraintes d'import. |

## Méthode de rédaction recommandée

1. Produire les fichiers de la section 10 pour stabiliser le vocabulaire.
2. Reprendre la section 30 depuis la doc existante et le code actuel.
3. Documenter `index.html` en section 20.
4. Exporter ou inspecter le schéma Grist DEV en lecture seule avant de rédiger la section 40.
5. Rédiger les parcours métier à partir des pages locales DEV.
6. Comparer les workflows n8n DEV/PROD avant la section 60.
7. Finaliser la section 70 avec les checklists de migration.

## Points à vérifier avant documentation finale

- Confirmer le schéma Grist DEV avec MCP/export schema.
- Identifier précisément ce qui est déjà en PROD et ce qui reste DEV.
- Confirmer les noms de colonnes des tables de refus, déclarations, comptes et marchés.
- Confirmer les URLs finales du wrapper PROD.
- Confirmer les workflows n8n actifs et leurs chemins de webhook.

