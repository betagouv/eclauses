# Authentification `AuthLink`

L'authentification applicative repose sur la visibilité d'une ligne dans `AuthLink`.

## Chargement de session

`loadAuth()` lit :

```js
const rows = await this.gristAPI.getData('AuthLink');
```

Le comportement attendu est d'obtenir exactement une ligne visible par les ACL Grist. Si aucune ligne ou plusieurs lignes sont visibles, la session est considérée comme non authentifiée.

## Colonnes utilisées

| Colonne | Usage |
|---|---|
| `Email` | Email affiché dans le menu connecté. |
| `Token` | Token de session. |
| `Expire_le` | Expiration du lien ou de la session. |
| `Beneficiaire` | Référence bénéficiaire. |
| `Repondant` | Référence répondant. |
| `Acheteur` | Référence acheteur. |
| `Roles` | ChoiceList des rôles applicatifs. |

## Filtrage métier des rôles

Avant de créer la session, le runtime vérifie certains états métier :

- si un bénéficiaire référencé n'existe pas, n'est pas `Eligible`, ou a `Doit_supprimer`, le rôle `beneficiaire` est retiré ;
- si un répondant référencé n'existe pas ou a `Doit_supprimer`, le rôle `repondant` est retiré.

Si plus aucun rôle ne reste, l'utilisateur est considéré comme non connecté.

## Objet session

La session exposée par `gristAPI.getAuth()` contient :

```js
{
  email,
  token,
  expiresAt,
  beneficiaireId,
  repondantId,
  acheteurId,
  roles
}
```

Les pages doivent utiliser `gristAPI.getAuth()` plutôt que de relire directement `AuthLink` quand elles ont seulement besoin du contexte utilisateur.

