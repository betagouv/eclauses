# AuthLink et comptes

## Principe

`AuthLink` relie une identité de connexion à un ou plusieurs rôles applicatifs.

Une ligne peut référencer :

- un bénéficiaire ;
- un répondant ;
- un acheteur ;
- une liste de rôles.

Le runtime filtre ensuite les rôles selon l'état métier des lignes référencées.

## Activation et mot de passe

Le parcours d'activation/reset est porté par :

- [mot-de-passe-oublie](../../grist/page/mot-de-passe-oublie) ;
- [reset-password](../../grist/page/reset-password) ;
- `Application_Password_Reset` ;
- les webhooks n8n configurés dans `Application_Env`.

Lors de la création de compte, l'utilisateur doit accepter les Conditions générales d'utilisation dans `reset-password`.

## Conservation et suppression logique

Les règles de conservation récentes introduisent :

- `Beneficiaires.Eligible` ;
- `Beneficiaires.Doit_supprimer` ;
- `Repondants.Doit_supprimer` ;
- colonnes équivalentes côté candidats/titulaires si présentes.

Quand `Doit_supprimer` est vrai, les données personnelles doivent être vidées, mais la ligne métier doit rester pour conserver les références historiques.

Le compte `AuthUser` associé doit aussi être supprimé par automatisation.

