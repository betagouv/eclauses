# Composants partagés

Les composants partagés sont stockés dans `Application_Composants` avec `component_type = component`, puis exposés via :

```js
gristAPI.getComponent('NomDuComposant')
```

## `helpers`

Le composant [helpers](../../grist/composants/helpers) exporte un objet utilitaire :

- normalisation de booléens ;
- conversion tableau ;
- recherche insensible à la casse ;
- validation email ;
- choix de champ label ;
- conversion options ;
- parsing et format de dates ;
- tri français ;
- debounce/throttle ;
- raccourci de navigation.

## `ComboBox`

Le composant [ComboBox](../../grist/composants/ComboBox) est utilisé pour les référentiels et multisélections.

Fonctions :

- sélection simple ou multiple ;
- champ de recherche ;
- résumé par nombre ou liste ;
- tri alphabétique par label ;
- options désactivables ;
- tooltip DSFR si l'option contient `tooltip`.

Exemple d'option :

```js
{ value: 12, label: 'Arts graphiques', tooltip: 'Documents, estampes, dessins...' }
```

Pour les spécialités, la colonne Grist `Tooltip` doit être injectée dans les options par la page appelante.

## Contraintes

- Le composant doit exporter via `module.exports` ou `Component`.
- Le JSX est transformé par Babel dans le navigateur.
- Les imports ESM ne sont pas supportés.

