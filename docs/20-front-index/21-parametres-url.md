# Paramètres d'URL

## Paramètres publics

| Paramètre | Rôle |
|---|---|
| `Token_` | Token d'accès transmis à Grist et utilisé par les ACL. |
| `page_` | Page à ouvrir dans le widget. |
| `marche_` | Identifiant marché transmis aux parcours liés à un marché. |

Le wrapper transmet uniquement `page_` et `marche_` depuis l'URL publique vers l'iframe. `Token_` est traité séparément.

## Cycle `Token_`

1. L'utilisateur arrive sur une URL publique contenant `Token_`.
2. `index.html` lit la valeur.
3. La valeur est stockée dans un cookie `Token_` pour 7 jours.
4. Le paramètre est retiré de l'URL avec `history.replaceState`.
5. Le cookie est relu.
6. `Token_` est ajouté à l'URL de l'iframe.

Ce mécanisme évite de conserver le token dans la barre d'adresse tout en permettant les refresh et la navigation ultérieure.

## Paramètres côté widget

Dans [widget-app.js](../../grist-dsfr-react-app/widget-app.js), la méthode `getMergedParams()` fusionne :

- `window.location.search` ;
- `window.top.location.search` si accessible ;
- `document.referrer` si exploitable.

Le chargement initial accepte :

- `p` ;
- `page` ;
- `page_`.

Le premier identifiant trouvé et présent dans `Application_Composants` est chargé. Sinon, le widget redirige vers la page par défaut selon le rôle ou vers la home publique.

