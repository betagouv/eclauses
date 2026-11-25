# Espace acheteur

L'espace acheteur permet de gérer le cycle complet d'un marché avec clause sociale.

## Accueil

[acheteur-home](../../grist/page/acheteur-home) affiche les informations de synthèse et les bandeaux d'alerte, notamment les déclarations à valider.

## Liste des marchés

[acheteur-marches](../../grist/page/acheteur-marches) affiche les marchés parents dans trois onglets :

- Préparation du marché ;
- Consultation et passation ;
- Exécution.

Les lots ne sont pas affichés comme lignes principales dans cette liste. Ils sont gérés dans la fiche marché ou dans les pages dédiées.

## Déclaration d'un marché

[acheteur-marches-declaration](../../grist/page/acheteur-marches-declaration) remplace l'ancienne modale de création.

La page permet :

- de créer un marché parent ;
- de cocher `Marché alloti` ;
- de créer un ou plusieurs lots si le marché est alloti ;
- de créer un marché non alloti sans lot enfant.

## Modification d'un marché

[acheteur-marches-modification](../../grist/page/acheteur-marches-modification) remplace l'ancienne modale de modification.

La modification des lots se fait uniquement tant que le marché est en préparation. Les lots peuvent être ajoutés, modifiés ou supprimés depuis cette page.

## Détail et gestion

[acheteur-marches-detail](../../grist/page/acheteur-marches-detail) regroupe :

- informations du marché ;
- informations des lots ;
- déclaration titulaire ;
- relance titulaire ;
- consultation des déclarations ;
- validation/refus ;
- bénéficiaires déclarés ;
- visualisation des fiches bénéficiaires.

Pour un marché non alloti, les informations et actions sont affichées directement au niveau racine, sans section lots.

## Exécution

Dans l'onglet Exécution :

- `En cours de validation` regroupe les marchés en attente de déclaration et les déclarations à valider ;
- `Clause sociale validée` regroupe les marchés dont tous les lots sont validés ou archivés.

Pour les marchés allotis, les badges synthétisent le nombre de lots par état. Quand aucun lot n'est dans un état, le badge est gris.

