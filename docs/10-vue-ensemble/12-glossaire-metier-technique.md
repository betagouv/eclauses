# Glossaire

## Acteurs

**Acheteur** : utilisateur représentant une entité acheteuse. Il crée les marchés, publie la consultation, déclare les titulaires, suit les déclarations et valide ou refuse les bénéficiaires.

**Candidat** : répondant intéressé par un marché ou un lot avant notification. Dans l'application, il est porté par la table des répondants et les pages `repondant-*`.

**Titulaire** : répondant retenu sur un marché ou un lot. Il déclare les bénéficiaires avec lesquels il travaille.

**Répondant** : compte applicatif pouvant être candidat et/ou titulaire.

**Bénéficiaire** : personne éligible à une clause sociale, visible dans les annuaires selon ses règles d'éligibilité et de consentement.

## Marchés

**Marché parent** : ligne de `Marches` sans `Marche_parent`. Elle porte la publication, le lien candidat et les informations communes.

**Lot enfant** : ligne de `Marches` dont `Marche_parent` référence un marché parent. Elle porte les informations propres au lot, le titulaire et les déclarations.

**Marché non alloti** : marché sans lot enfant. Les informations de clause, titulaire et déclaration restent sur la ligne parent.

**Clause sociale** : obligation sociale rattachée à un marché ou à un lot. Pour le modèle actuel, on ne gère qu'une clause sociale par lot.

## Widget

**Composant page** : composant React stocké dans `Application_Composants` et chargé comme page navigable.

**Composant partagé** : composant React stocké dans `Application_Composants` avec `component_type = component`, disponible via `gristAPI.getComponent()`.

**Child component** : composant créé dynamiquement avec des overrides via `gristAPI.getChildComponent()` ou `createChildComponent()`.

**template_id** : identifiant technique d'un composant dans `Application_Composants`. Il correspond généralement au nom du fichier local dans `grist/page` ou `grist/composants`.

## Authentification

**AuthLink** : table de session contenant le token, l'email, les rôles et les références vers les acteurs métier.

**Token_** : paramètre/cookie utilisé par le wrapper et le widget pour donner à Grist le contexte d'accès attendu par les ACL.

**Espace actif** : rôle actuellement sélectionné dans l'interface lorsqu'un utilisateur possède plusieurs rôles.

