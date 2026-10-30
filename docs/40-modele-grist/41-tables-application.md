# Tables application

## `Application_Composants`

Cette table est la source runtime des pages et composants.

Colonnes utilisées par [widget-app.js](../../grist-dsfr-react-app/widget-app.js) :

| Colonne | Rôle |
|---|---|
| `template_id` | Identifiant technique, souvent identique au nom du fichier local. |
| `template_name` | Libellé affiché dans la navigation. |
| `component_type` | `component` pour shared component, autre valeur pour page. |
| `component_code` | Code JSX/React. |
| `show_in_nav` | Afficher dans la navigation. |
| `show_in_nav_when_authed` | Afficher seulement connecté. |
| `hide_in_nav_when_authed` | Masquer connecté. |
| `nav_roles` | Rôles concernés par la navigation. |
| `allowed_roles` | Alternative historique utilisée pour les rôles. |
| `nav_order` | Ordre de navigation. |
| `default_component` | Page par défaut possible. |
| `requires_auth` | Accès restreint aux utilisateurs connectés. |

Les fichiers locaux à synchroniser sont :

- pages : [grist/page](../../grist/page) ;
- composants : [grist/composants](../../grist/composants).

## `Application_Env`

Table clé/valeur lue par `loadEnv()`.

Exemples de clés observées dans le code :

- `DEBUG` ;
- `N8N_LOGIN_URL` ;
- `N8N_RESET_URL` ;
- `N8N_SUPPORT_URL` ;
- `N8N_CANDIDAT_VERIFICATION_INSCRIPTION` ;
- `N8N_RELANCE_TITULAIRE` ;
- `RELANCE_TITULAIRE_DELAY_DAYS`.

## Header, footer et liens

`Application_Header`, `Application_Footer` et `Application_Liens` configurent l'interface permanente.

`Application_Liens` est normalisée par `loadUiConfig()` avec :

- `Label` ;
- `Url` ;
- `Nav` ;
- `Variant` ;
- `External` ;
- `Ordre` ;
- `Target`.

Un lien avec `Nav` génère un lien interne `data-nav`. Un lien avec `Url` génère une ancre externe ou interne classique.

## FAQ et support

Le centre d'aide utilise :

- `Application_FAQ_Categories` ;
- `Application_FAQ_Questions`.

Le formulaire dédié `support-contact` utilise le webhook `N8N_SUPPORT_URL`.

