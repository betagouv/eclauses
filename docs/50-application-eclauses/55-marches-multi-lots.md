# Parcours marchés multi-lots

## Création

L'acheteur crée un marché parent. S'il coche `Marché alloti`, il crée aussi les lots couverts par une clause sociale.

Si le marché n'est pas alloti, aucun lot enfant ne doit être créé automatiquement.

## Publication

La publication est déclarée au niveau parent :

- date de publication ;
- lien vers les documents de consultation ;
- passage en consultation/passation.

Une seule notification de publication est envoyée pour le marché parent. L'email présente la liste des lots concernés.

## Inscription candidat

Le lien candidat contient l'identifiant du marché parent.

Le formulaire :

- affiche les lots enfants disponibles si le marché est alloti ;
- demande au candidat de sélectionner un ou plusieurs lots ;
- affiche seulement le label du marché si non alloti, sans case à décocher.

## Déclaration titulaire

En consultation :

- marché non alloti : bouton `Déclarer le titulaire` au niveau marché ;
- marché alloti : bouton `Déclarer les titulaires` ouvrant une liste de lots.

Quand un lot a déjà un titulaire, son bouton devient `Titulaire déclaré` et est désactivé.

Le parent ne passe en `En attente de déclaration des bénéficiaires` que lorsque tous les lots ont un titulaire.

## Validation

Chaque lot avance indépendamment :

```text
En attente de déclaration des bénéficiaires
  -> Déclaration à valider
    -> Clause validée
```

Le parent affiche le statut le plus faible parmi ses lots selon l'ordre fonctionnel.

