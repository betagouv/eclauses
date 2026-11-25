# Cookie de session `Token_`

Le cookie `Token_` est créé par [index.html](../../index.html) quand le paramètre `Token_` est présent dans l'URL publique.

## Paramètres du cookie

```text
Name: Token_
Max-Age: 7 jours
Path: /
SameSite: Lax
```

Le wrapper ne définit pas `Secure` directement lors de la création. La déconnexion dans le widget tente de supprimer le cookie avec ou sans domaine selon le contexte.

## Déconnexion

La méthode `logout()` de [widget-app.js](../../grist-dsfr-react-app/widget-app.js) :

- vide `session.auth` ;
- vide `session.activeSpace` ;
- supprime `localStorage.activeSpace` ;
- retire `Token_` du cookie ;
- retire `Token_` de l'URL top ;
- recharge la page sans token.

## Sécurité

Le cookie ne donne pas accès par lui-même. Le contrôle principal vient du fait que Grist ne rend visible qu'une ligne `AuthLink` correspondant au token, selon les ACL du document.

