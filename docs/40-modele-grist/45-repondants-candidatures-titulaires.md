# Répondants, candidatures et titulaires

La table `Repondants` porte les acteurs qui peuvent être candidats et/ou titulaires.

## Candidat

Un candidat s'inscrit depuis un lien de marché parent. Le formulaire [inscription-candidat](../../grist/page/inscription-candidat) :

- lit l'identifiant de marché transmis ;
- retrouve les lots enfants disponibles ;
- affiche le marché seul si non alloti ;
- permet de sélectionner un ou plusieurs lots si le marché est alloti ;
- force l'email en minuscule.

## Titulaire

Un titulaire est déclaré par l'acheteur :

- au niveau lot pour un marché alloti ;
- au niveau parent pour un marché non alloti.

Lors de la déclaration titulaire, l'acheteur doit :

- renseigner l'email du titulaire ;
- confirmer que le titulaire a été notifié sur PLACE ;
- renseigner la date de fin d'exécution prévisionnelle si nécessaire.

## Ordre d'affichage

Dans `repondant-marches`, les marchés/lots titulaires doivent être ordonnés ainsi :

1. `En attente de déclaration des bénéficiaires`
2. `Déclaration à valider`
3. `Clause validée`
4. `Archivé`

## Suppression logique

Si `Doit_supprimer` est vrai pour un répondant, ses données personnelles doivent être supprimées et son rôle retiré côté runtime.

