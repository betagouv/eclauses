# Registre des schémas Excalidraw

Les schémas doivent être créés au format `.excalidraw` dans [diagrams](diagrams). Ils doivent représenter les flux réels avec les noms de tables, fichiers et paramètres utilisés dans le projet.

## Schémas prioritaires

### `architecture-globale.excalidraw`

Objectif : montrer les couches du système complet.

Contenu attendu :

- navigateur ;
- `index.html` ;
- iframe Grist ;
- `widget-app.html` ;
- `widget-app.js / ReactApp` ;
- `Application_Composants` ;
- tables métier ;
- n8n ;
- emails ;
- fichiers locaux `grist/page/*` et `grist/composants/*`.

### `routage-index-iframe.excalidraw`

Objectif : expliquer la transformation des paramètres publics vers l'iframe.

Contenu attendu :

- URL publique avec `Token_`, `page_`, `marche_` ;
- cookie `Token_` ;
- nettoyage URL ;
- propagation vers iframe ;
- ajout `style=singlePage` ;
- offsets responsive.

### `runtime-widget.excalidraw`

Objectif : expliquer comment une page est chargée et rendue.

Contenu attendu :

- `grist.ready({ requiredAccess: 'full' })` ;
- `loadAuth()` ;
- `loadComponents()` ;
- `loadEnv()` ;
- `loadUiConfig()` ;
- `setupNavigation()` ;
- `loadDefaultComponent()` ;
- Babel ;
- `new Function()` ;
- `ReactDOM.createRoot()`.

### `auth-et-roles.excalidraw`

Objectif : montrer la résolution de session.

Contenu attendu :

- `AuthLink` visible par ACL ;
- `Roles` ;
- références `Beneficiaire`, `Acheteur`, `Repondant` ;
- filtres `Eligible` et `Doit_supprimer` ;
- `activeSpace` ;
- menu connecté.

### `modele-marches-parent-enfant.excalidraw`

Objectif : expliquer la table unique `Marches`.

Contenu attendu :

- ligne marché parent ;
- lignes lots enfants ;
- `Marche_parent` ;
- `Lots` ;
- publication parent ;
- lien candidat parent ;
- titulaire/déclaration/validation par lot ;
- cas non alloti sans lot enfant.

### `parcours-publication-multilots.excalidraw`

Objectif : montrer le parcours de publication et inscription.

Contenu attendu :

- acheteur crée marché ;
- lots optionnels ;
- publication parent ;
- email unique ;
- candidat ouvre le lien parent ;
- sélection d'un ou plusieurs lots ;
- candidature par lot.

### `parcours-declaration-validation-refus.excalidraw`

Objectif : montrer le cycle titulaire -> bénéficiaires -> acheteur.

Contenu attendu :

- invitation titulaire par lot ;
- déclaration bénéficiaires ;
- statut `Déclaration à valider` ;
- validation avec cases de confirmation ;
- refus avec motif ;
- retour en brouillon ;
- clause validée.

### `flux-n8n-emails.excalidraw`

Objectif : cartographier les workflows n8n et emails.

Contenu attendu :

- webhooks ;
- tables Grist lues/écrites ;
- emails publication, invitation, relance, validation, activation compte ;
- différences attendues DEV/PROD.

## Conventions graphiques

- Couche publique : bleu.
- Widget/runtime : vert.
- Données Grist : violet.
- n8n et emails : orange.
- Sécurité/ACL : rouge discret.
- DEV/PROD : distinguer par étiquette, pas par duplication exhaustive.

## Critères de validation

Chaque schéma doit :

- utiliser les vrais noms de fichiers, tables et colonnes ;
- montrer le sens des données ;
- inclure au moins un exemple concret de paramètre, payload ou statut quand c'est utile ;
- être lisible sans devoir ouvrir le code ;
- être maintenu avec le fichier Markdown correspondant.

