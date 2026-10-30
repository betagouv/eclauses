# Marchés parent/enfant

Le modèle cible conserve une seule table `Marches`.

## Règles de structure

| Cas | Règle |
|---|---|
| Marché parent | `Marche_parent` vide. |
| Lot enfant | `Marche_parent` référence le parent. |
| Marché alloti | Parent avec un ou plusieurs lots enfants. |
| Marché non alloti | Parent sans lot enfant. |

La colonne `Lots` est une liste inverse ou une ref-list permettant de retrouver les enfants d'un parent.

## Colonnes principales observées

| Colonne | Niveau |
|---|---|
| `Intitule_du_marche` | Parent et parfois fallback lot. |
| `Intitule_propre` | Parent ou libellé calculé. |
| `Intitule_du_lot` | Lot. |
| `Numero_de_lot` | Lot. |
| `Acheteur` | Parent et/ou lot selon duplication. |
| `Clauses_sociales` | Lot, ou parent si non alloti. |
| `Specialites_du_marche` | Lot, ou parent si non alloti. |
| `Lieu_d_execution` | Lot, ou parent si non alloti. |
| `Date_de_publication` | Parent. |
| `Date_Limite_de_Remise_des_Offres` | Parent. |
| `Date_de_notification_previsionnelle` | Parent. |
| `Date_de_fin_d_execution` | Lot, ou parent si non alloti. |
| `Statut` | Lot, ou parent selon état global/non alloti. |
| `Statut_global` | Parent si formule disponible. |
| `Lien_Inscription_Candidat` | Parent. |
| `Lien_vers_les_documents_de_consultation` | Parent. |
| `Invitation_Titulaire_Marche` | Lot ou parent non alloti. |
| `Titulaire` | Lot ou parent non alloti. |
| `Beneficiaires` | Lot ou parent non alloti. |

## Statuts

Ordre fonctionnel du plus faible au plus avancé :

1. `En attente de publication`
2. `En attente de notification`
3. `En attente de déclaration des bénéficiaires`
4. `Déclaration à valider`
5. `Clause validée`
6. `Archivé`

`Déclaration à vérifier` ne fait plus partie du processus actif.

## Règles métier

- La publication est déclarée au niveau parent.
- Le lien candidat est unique au niveau parent.
- Le candidat sélectionne un ou plusieurs lots lors de l'inscription.
- Le titulaire est déclaré par lot.
- Les déclarations bénéficiaires sont faites par lot.
- La validation/refus est faite par lot.
- Le parent passe en `En attente de déclaration des bénéficiaires` uniquement quand tous les lots ont un titulaire.
- Le parent passe en `Clause validée` quand tous les lots sont validés.
- Pour un marché non alloti, toutes les actions sont faites sur la ligne parent.

