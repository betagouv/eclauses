# Objet `gristAPI`

`gristAPI` est l'API stable exposée aux pages React.

## Session

| Méthode | Usage |
|---|---|
| `getAuth()` | Retourne la session courante. |
| `isAuthenticated()` | Indique si une session existe. |
| `refreshAuth()` | Recharge `AuthLink` et retourne la session. |
| `goToLanding()` | Redirige vers la page d'atterrissage par rôle. |
| `goToDefault()` | Retourne à la page par défaut. |

## Sélection Grist

| Méthode | Usage |
|---|---|
| `getSelection()` | Retourne la sélection courante du widget Grist. |
| `onRecord(handler)` | Abonnement à la ligne courante. |
| `onRecords(handler)` | Abonnement aux lignes courantes. |

## Navigation et configuration

| Méthode | Usage |
|---|---|
| `navigate(componentId, options)` | Charge une page. |
| `getQueryParams()` | Retourne les paramètres fusionnés. |
| `getComponent(name)` | Retourne un composant partagé. |
| `getEnv(key, fallback)` | Lit `Application_Env`. |

## Composants enfants

| Méthode | Usage |
|---|---|
| `getChildComponent(templateId, overrides)` | Charge un template et crée un composant avec API locale enrichie. |
| `createChildComponent(template, overrides)` | Crée directement un child component depuis un template. |

## Données

| Méthode | Action Grist |
|---|---|
| `getData(tableName)` | `grist.docApi.fetchTable(tableName)` puis normalisation en lignes. |
| `addRecord(tableName, record)` | `AddRecord`. |
| `updateRecord(tableName, recordId, updates)` | `UpdateRecord`. |
| `deleteRecord(tableName, recordId)` | `RemoveRecord`. |

## Helpers

Les helpers intégrés incluent :

- `toBool()` ;
- `asArray()` ;
- `includesIci()` ;
- `emailLooksOk()` ;
- `pickLabelField()` ;
- `toOptions()` ;
- `parseDate()` ;
- `formatDate()` ;
- `daysLeft()` ;
- `validLatLng()`.

Un composant partagé [helpers](../../grist/composants/helpers) existe aussi avec des helpers complémentaires comme `sortByLabelFr`, `debounce`, `throttle` et `go`.

