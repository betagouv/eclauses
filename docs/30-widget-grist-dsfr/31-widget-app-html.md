# Shell `widget-app.html`

[widget-app.html](../../grist-dsfr-react-app/widget-app.html) fournit la structure HTML permanente du widget.

## Header

Le header DSFR contient :

- le logo institutionnel ;
- le titre de service ;
- un badge ;
- une zone `#header-tools-links` alimentée par `Application_Header` et `Application_Liens` ;
- une zone `#header-user` alimentée par la session ;
- le menu mobile `#modal-nav` ;
- la navigation principale `#navigation`.

Les liens générés peuvent être :

- des liens externes ;
- des liens internes avec `data-nav`.

## Main

Le contenu applicatif est rendu dans :

```html
<main class="main" id="main-content">
```

Au chargement, le main contient un loader DSFR :

- `#loading` ;
- `role="status"` ;
- `aria-live="polite"` ;
- `aria-busy="true"`.

`ReactApp.hideLoading()` masque ce loader quand l'application est prête.

## Footer

Le footer DSFR contient :

- logo ;
- description ;
- liens principaux ;
- liens bas de page ;
- mention de licence.

Ces éléments sont remplacés par `renderFooterConfig()` après lecture de `Application_Footer` et `Application_Liens`.

## Ordre des scripts

L'ordre de chargement est important :

1. `grist-plugin-api.js`
2. React
3. ReactDOM
4. ReactDOM Client
5. Babel Standalone
6. DSFR JS module et nomodule
7. `widget-app.js`

`widget-app.js` suppose que `grist`, `React`, `ReactDOM` et `Babel` sont disponibles globalement.

