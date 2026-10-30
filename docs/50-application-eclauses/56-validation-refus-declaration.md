# Validation et refus de déclaration

## Consultation

L'acheteur ouvre la fiche marché et clique sur `Consulter la déclaration` pour un lot au statut `Déclaration à valider`.

Dans cet état, les bénéficiaires déclarés ne sont pas affichés en dehors de la modale de consultation afin d'éviter une validation implicite.

## Validation

La validation nécessite des confirmations :

- éligibilité du bénéficiaire ;
- relation contractuelle titulaire/bénéficiaire.

Pour un bénéficiaire Eclauses, l'éligibilité est précochée et non décochable.

Pour un bénéficiaire externe, les deux confirmations sont obligatoires.

Après validation :

- les déclarations passent en `validé` ;
- le lot passe en `Clause validée` ;
- si tous les lots sont validés, le parent passe en `Clause validée`.

## Refus

Le bouton `Refuser la déclaration` ouvre une modale de motif.

Le motif est obligatoire. Une fois confirmé :

- un enregistrement est créé dans `Declarations_Beneficiaires_Refus` ;
- les déclarations repassent en `brouillon` ;
- le lot repasse en `En attente de déclaration des bénéficiaires` ;
- le titulaire voit la raison et la date du refus lors de la déclaration suivante.

