# Déclarations bénéficiaires

## Table principale

`Declarations_Beneficiaires` porte les bénéficiaires déclarés par un titulaire pour un marché ou un lot.

Une déclaration peut concerner :

- un bénéficiaire Eclauses référencé ;
- un bénéficiaire externe saisi par le titulaire.

## Validation acheteur

Dans la vue détail/gestion marché, l'acheteur consulte la déclaration.

Pour chaque bénéficiaire externe, l'acheteur doit cocher :

- `Je confirme que le bénéficiaire est éligible à la clause sociale du marché`
- `Je confirme qu'il existe une relation contractuelle entre le titulaire et le bénéficiaire (DC2, DC4 ou embauche directe)`

Pour un bénéficiaire Eclauses :

- la confirmation d'éligibilité est cochée par défaut ;
- elle n'est pas décochable ;
- la fiche bénéficiaire peut être consultée.

Pour un bénéficiaire externe :

- le bouton de fiche n'est pas affiché ;
- la carte précise qu'il s'agit d'un bénéficiaire externe.

## Refus

Le refus est enregistré dans `Declarations_Beneficiaires_Refus`.

Champs observés dans le code :

- `Marche` ;
- `Refuse_le` ;
- `Refuse_par` ;
- `Raison`.

Le motif est obligatoire. Après refus :

- les déclarations repassent en `brouillon` ;
- le marché ou lot repasse en `En attente de déclaration des bénéficiaires` ;
- le répondant voit une alerte avec la date et la raison du refus.

