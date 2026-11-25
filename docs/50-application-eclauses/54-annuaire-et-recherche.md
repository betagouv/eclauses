# Annuaires et recherche

Les annuaires sont utilisés par plusieurs rôles :

- [acheteur-annuaire](../../grist/page/acheteur-annuaire) ;
- [beneficiaire-annuaire](../../grist/page/beneficiaire-annuaire) ;
- [repondant-recherches](../../grist/page/repondant-recherches).

## Règles d'affichage bénéficiaire

Un bénéficiaire est affiché si :

- `Eligible` est vrai ;
- `Doit_supprimer` est faux ;
- il correspond aux filtres de recherche.

## Coordonnées

Si le bénéficiaire ne souhaite pas être contacté pour rejoindre un groupement :

- masquer email et téléphone ;
- afficher le message :

```text
Cette personne ne souhaite pas être contactée pour rejoindre un groupement.
```

## Badge intérêt exprimé

Le badge harmonisé doit rester un badge DSFR avec :

- texte `Intérêt exprimé` ;
- étoile avant le texte ;
- classe `fr-badge--no-icon`.

## Spécialités

Le référentiel `T0_Referentiel_Specialites` conserve les libellés existants. La colonne `Tooltip` fournit une description affichée au survol dans `ComboBox`.

