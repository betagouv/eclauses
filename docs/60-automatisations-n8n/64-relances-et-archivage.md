# Relances, archivage et suppression logique

## Relances

Les relances titulaires doivent être historisées avec la date de dernière relance afin d'éviter les relances trop fréquentes et les pénalités.

Côté acheteur, cette date est affichée sous le bouton de relance.

## Archivage marchés

Workflow prévu :

1. rechercher les marchés/lots dont `Date_de_fin_d_execution` est dépassée de 6 mois ;
2. exclure ceux déjà archivés ;
3. passer le statut à `Archivé` ;
4. si tous les lots d'un parent sont archivés, archiver le parent.

## Suppression logique

Les workflows de suppression logique doivent utiliser des nodes explicites, idéalement Grist, pour chaque action :

- rechercher lignes `Doit_supprimer = true` ;
- vider données personnelles ;
- remplacer le nom par un libellé anonymisé ;
- conserver les références ;
- supprimer le compte `AuthUser`.

Éviter un unique node code qui masque toutes les actions.

