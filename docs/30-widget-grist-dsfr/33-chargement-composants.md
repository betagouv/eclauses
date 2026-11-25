# Chargement des composants

Les composants sont chargés depuis `Application_Composants`.

## Colonnes attendues

Le runtime utilise principalement :

| Colonne | Usage |
|---|---|
| `template_id` | Identifiant technique et cible de navigation. |
| `template_name` | Nom affiché dans la navigation. |
| `component_type` | `component` pour composant partagé, autre valeur pour page. |
| `component_code` | Code JSX/React. |
| `show_in_nav` | Affichage dans la navigation principale. |
| `show_in_nav_when_authed` | Visible uniquement connecté. |
| `hide_in_nav_when_authed` | Caché si connecté. |
| `nav_roles` ou `allowed_roles` | Rôles autorisés dans la navigation et l'espace actif. |
| `nav_order` | Ordre de navigation. |
| `default_component` | Page par défaut possible. |
| `requires_auth` | Accès réservé aux sessions authentifiées. |

## Pages et composants partagés

Dans `loadComponents()` :

- si `component_type.toLowerCase() === 'component'`, le code est instancié comme shared component ;
- sinon, le code est enregistré comme page navigable.

Les composants partagés sont récupérés dans les pages par :

```js
const ComboBox = gristAPI.getComponent('ComboBox');
```

## Nettoyage du code

`sanitizeCode()` :

- normalise les fins de lignes ;
- retire les caractères de contrôle ;
- trim le code.

Les fichiers locaux dans `grist/page` et `grist/composants` doivent donc contenir uniquement du code exécutable par le runtime Grist, sans balise `<script>` ni import ESM non supporté.

