# Documentation technique Eclauses

Ce dossier regroupe la documentation technique cible du système Eclauses.

La documentation doit couvrir trois blocs principaux :

1. Le widget Grist DSFR React, qui charge les pages depuis `Application_Composants` et expose `gristAPI`.
2. Le front `index.html`, qui encapsule l'iframe Grist, propage certains paramètres GET et ajuste l'affichage.
3. L'application métier Eclauses développée avec ce widget : rôles, données Grist, parcours marchés, annuaires, emails et automatisations n8n.

Point d'attention : plusieurs modifications existent actuellement en DEV et ne sont pas encore déployées en PROD. Toute documentation de structure ou de parcours doit indiquer explicitement si elle décrit l'état DEV, l'état PROD, ou l'état cible.

## Fichiers de cadrage

- [00-plan-documentation.md](00-plan-documentation.md) : plan complet de la documentation à rédiger.
- [01-cartographie-sources.md](01-cartographie-sources.md) : sources techniques à analyser et à maintenir alignées.
- [02-registre-schemas.md](02-registre-schemas.md) : liste des schémas Excalidraw à produire.

## Documentation rédigée

### Vue d'ensemble

- [Architecture globale](10-vue-ensemble/10-architecture-globale.md)
- [Environnements DEV et PROD](10-vue-ensemble/11-environnements-dev-prod.md)
- [Glossaire](10-vue-ensemble/12-glossaire-metier-technique.md)

### Front public `index.html`

- [Rôle du front](20-front-index/20-role-index-html.md)
- [Paramètres d'URL](20-front-index/21-parametres-url.md)
- [Iframe Grist et affichage](20-front-index/22-iframe-grist-et-affichage.md)
- [Cookie de session](20-front-index/23-cookies-session-token.md)

### Widget Grist DSFR

- [Architecture du widget](30-widget-grist-dsfr/30-architecture-widget.md)
- [Shell `widget-app.html`](30-widget-grist-dsfr/31-widget-app-html.md)
- [Runtime `ReactApp`](30-widget-grist-dsfr/32-reactapp-runtime.md)
- [Chargement des composants](30-widget-grist-dsfr/33-chargement-composants.md)
- [Navigation et espaces](30-widget-grist-dsfr/34-navigation-et-espaces.md)
- [Authentification AuthLink](30-widget-grist-dsfr/35-authentification-authlink.md)
- [Objet `gristAPI`](30-widget-grist-dsfr/36-gristapi.md)
- [Composants partagés](30-widget-grist-dsfr/37-composants-partages.md)
- [Gestion des erreurs et debug](30-widget-grist-dsfr/38-gestion-erreurs-debug.md)

### Modèle Grist

- [Vue d'ensemble des tables](40-modele-grist/40-vue-ensemble-tables.md)
- [Tables application](40-modele-grist/41-tables-application.md)
- [AuthLink et comptes](40-modele-grist/42-authlink-et-comptes.md)
- [Marchés parent/enfant](40-modele-grist/43-marches-parent-enfant.md)
- [Bénéficiaires](40-modele-grist/44-beneficiaires.md)
- [Répondants, candidatures et titulaires](40-modele-grist/45-repondants-candidatures-titulaires.md)
- [Déclarations bénéficiaires](40-modele-grist/46-declarations-beneficiaires.md)
- [Permissions et ACL](40-modele-grist/47-permissions-acl.md)
- [Pièces jointes et CV](40-modele-grist/48-pieces-jointes-et-cv.md)

### Application Eclauses

- [Parcours public](50-application-eclauses/50-parcours-public.md)
- [Espace bénéficiaire](50-application-eclauses/51-espace-beneficiaire.md)
- [Espace candidat / titulaire](50-application-eclauses/52-espace-candidat-titulaire.md)
- [Espace acheteur](50-application-eclauses/53-espace-acheteur.md)
- [Annuaires et recherche](50-application-eclauses/54-annuaire-et-recherche.md)
- [Marchés multi-lots](50-application-eclauses/55-marches-multi-lots.md)
- [Validation et refus de déclaration](50-application-eclauses/56-validation-refus-declaration.md)
- [Archivage et suppression des données](50-application-eclauses/57-archivage-et-suppression-donnees.md)

### Automatisations n8n

- [Vue d'ensemble](60-automatisations-n8n/60-vue-ensemble.md)
- [Comptes et authentification](60-automatisations-n8n/61-authentification-et-comptes.md)
- [Notifications marchés](60-automatisations-n8n/62-notifications-marches.md)
- [Notifications déclarations](60-automatisations-n8n/63-notifications-declarations.md)
- [Relances, archivage et suppression logique](60-automatisations-n8n/64-relances-et-archivage.md)
- [Contrats d'entrée et sortie n8n](60-automatisations-n8n/65-contrats-d-entree-sortie.md)

### Déploiement et maintenance

- [Synchronisation `Application_Composants`](70-deploiement-maintenance/70-synchronisation-application-composants.md)
- [Checklist déploiement DEV vers PROD](70-deploiement-maintenance/71-checklist-deploiement-dev-prod.md)
- [Tests de non-régression](70-deploiement-maintenance/72-tests-de-non-regression.md)
- [Runbook incidents](70-deploiement-maintenance/73-runbook-incidents.md)
- [Règles production](70-deploiement-maintenance/74-regles-production.md)

## Documentation existante à reprendre

Un début de documentation existe dans [grist-dsfr-react-app/docs](../grist-dsfr-react-app/docs). Elle doit être reprise, actualisée et déplacée progressivement dans ce dossier racine afin de documenter le système complet, pas uniquement le moteur de widget.

> La documentation de la réécriture (Next.js, PostgreSQL) se trouve sur la branche `rewrite-postgres`, dossier `docs/80-reecriture/`.
