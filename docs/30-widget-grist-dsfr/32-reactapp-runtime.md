# Runtime `ReactApp`

La classe `ReactApp` orchestre toute l'application widget.

## État interne

| Propriété | Rôle |
|---|---|
| `components` | Map des pages navigables. |
| `sharedComponents` | Map des composants partagés. |
| `currentComponent` | `template_id` actuellement rendu. |
| `isReady` | Empêche la navigation avant initialisation complète. |
| `gristAPI` | API exposée aux composants. |
| `session.auth` | Session résolue depuis `AuthLink`. |
| `session.activeSpace` | Espace rôle actif. |
| `env` | Variables `Application_Env`. |
| `debugEnabled` | Activé via `Application_Env.DEBUG`. |
| `uiConfig` | Header/footer dynamiques. |

## Transformation Babel

`getBabelTransformOptions()` active :

- preset `react` ;
- plugin `transform-class-properties` si disponible ;
- plugin `transform-modules-commonjs` si disponible.

Cette logique évite l'erreur `Invalid plugin specified in Babel options: "proposal-class-properties"` rencontrée précédemment.

## Imports supportés

`getComponentRequire()` fournit un `require()` volontairement limité :

```js
require('react')
require('react/jsx-runtime')
require('react/jsx-dev-runtime')
```

Les imports non supportés déclenchent une erreur explicite :

```text
Import non supporté dans un composant Grist : <nom>
```

## Rendu React

Pour chaque page :

1. le container `#main-content` est vidé ;
2. un `div#react-container-<componentId>` est créé ;
3. le code est transformé par Babel ;
4. une fonction dynamique est créée par `new Function()` ;
5. le composant `Component` ou `module.exports` est récupéré ;
6. React rend la page via `ReactDOM.createRoot()`.

Avant de rendre une nouvelle page, l'ancienne root React est démontée si possible.

