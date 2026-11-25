# Synchronisation `Application_Composants`

## Source locale

Les pages et composants sont versionnés localement :

- pages : [grist/page](../../grist/page) ;
- composants partagés : [grist/composants](../../grist/composants).

Le nom du fichier correspond généralement à `Application_Composants.template_id`.

Exemples :

| Fichier | `template_id` attendu |
|---|---|
| `grist/page/acheteur-marches` | `acheteur-marches` |
| `grist/page/acheteur-marches-detail` | `acheteur-marches-detail` |
| `grist/composants/ComboBox` | `ComboBox` |
| `grist/composants/helpers` | `helpers` |

## Déploiement

Avant déploiement :

1. vérifier le diff local ;
2. vérifier que le fichier ne contient pas d'import ESM non supporté ;
3. vérifier que le composant exporte `Component` ou `module.exports` ;
4. pousser en DEV ;
5. tester en DEV ;
6. préparer le diff PROD ;
7. demander validation explicite avant toute écriture PROD.

## MCP Grist

Le MCP peut être utilisé pour inspecter la structure et éventuellement pousser des composants si les outils disponibles le permettent.

Règles :

- inspection read-only autorisée ;
- modification DEV autorisée si demandée ;
- modification PROD interdite sans validation explicite dans la conversation courante.

