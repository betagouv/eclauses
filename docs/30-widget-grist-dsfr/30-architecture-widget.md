# Architecture du widget Grist DSFR React

Le widget est composé de deux fichiers principaux :

- [widget-app.html](../../grist-dsfr-react-app/widget-app.html) : structure HTML DSFR et chargement des dépendances.
- [widget-app.js](../../grist-dsfr-react-app/widget-app.js) : runtime JavaScript `ReactApp`.

Il s'exécute dans une iframe Grist avec l'API `grist-plugin-api`.

## Dépendances chargées

Le shell charge :

- DSFR `1.14.1` ;
- React 18 UMD ;
- ReactDOM 18 UMD ;
- ReactDOM Client ;
- Babel Standalone ;
- Grist Plugin API ;
- `widget-app.js`.

Les composants dynamiques ne doivent pas utiliser d'import ESM classique. Le runtime fournit un `require()` limité à :

- `react` ;
- `react/jsx-runtime` ;
- `react/jsx-dev-runtime`.

Toute autre dépendance doit être exposée par le widget ou intégrée autrement.

## Cycle d'initialisation

Dans `ReactApp.init()` :

1. `grist.ready({ requiredAccess: 'full' })`.
2. `setupGristAPI()`.
3. `loadAuth()`.
4. `loadComponents()`.
5. `loadEnv()`.
6. `loadUiConfig()`.
7. `setupNavigation()`.
8. `setupGlobalNavHooks()`.
9. `renderHeaderUser()`.
10. `hideLoading()`.
11. `loadDefaultComponent()`.

Cette séquence impose que `gristAPI` existe avant le chargement de la session, car `loadAuth()` utilise `gristAPI.getData()`.

## Tables runtime

| Constante | Table |
|---|---|
| `COMPONENTS_TABLE` | `Application_Composants` |
| `AUTH_TABLE` | `AuthLink` |
| `HEADER_TABLE` | `Application_Header` |
| `FOOTER_TABLE` | `Application_Footer` |
| `LINKS_TABLE` | `Application_Liens` |

`Application_Env` est lue directement par `loadEnv()`.

