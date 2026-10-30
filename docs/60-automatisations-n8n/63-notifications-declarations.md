# Notifications déclarations

## Invitation titulaire

Déclenchée à la déclaration du titulaire sur un lot ou un marché non alloti.

L'email doit contenir :

- marché parent ;
- lot ;
- acheteur ;
- lien d'activation si le compte n'existe pas ;
- lien de connexion si le compte existe ;
- mention PLACE.

## Relance titulaire

Déclenchée par action acheteur ou automatisation.

Le lot conserve une date de dernière relance via `Invitation_Titulaire.Derniere_relance_le`.

## Déclaration à valider

Quand le titulaire soumet les bénéficiaires, l'acheteur reçoit une notification indiquant :

- marché parent ;
- lot ;
- titulaire ;
- nécessité de valider l'éligibilité.

## Clause validée

Après validation acheteur, les emails indiquent que la clause sociale du lot est activée.

## Bénéficiaire déclaré

Quand une ligne de `Declarations_Beneficiaires` est mise à jour (webhook `eclauses/beneficiaire/declarer/valide`) et que la condition sur `Statut` du nœud `If11` est remplie, le bénéficiaire reçoit un mail. L'adresse est `Email_envoi` : l'email saisi, sinon le courriel du bénéficiaire.

## Libellés « lot » et « marché »

Les mails ne doivent parler de « lot » que pour un lot. Pour un marché sans lot :

- l'objet dit « marché » (« titularisation sur un marché », « clause sociale activée pour un marché dont vous êtes titulaire ») ;
- le corps affiche une seule ligne « Marché : titre », sans ligne « Lot » ;
- les phrases comme « du lot suivant » ou « pour ce lot » deviennent « du marché suivant » ou « pour ce marché ».

Un lot est reconnu par `Est_lot` (payload `Marches`), par le numéro, l'intitulé ou le libellé de lot (payload `Invitation_Titulaire`), ou par `Marche_Est_lot` (payload `Declarations_Beneficiaires`, colonne à créer). Pour un lot, le mail affiche « Marché : titre du parent » puis « Lot : libellé du lot ».

Les champs lus doivent exister dans le payload de la table qui déclenche le webhook. Par exemple `Marche_Intitule_propre` ou `Marche_Numero_de_lot` (colonnes qui viennent d'une table liée) n'existent pas dans le payload de `Marches`, qui expose `Intitule_propre`, `Numero_de_lot`, `Lot_Label`, etc. : ne pas utiliser de chaînes de `||` sur des noms hypothétiques.

## Webhooks de la table `Declarations_Beneficiaires`

Deux webhooks Grist existent en DEV et manquaient en PROD, ce qui empêchait l'envoi des mails « bénéficiaire déclaré » et « déclaration refusée » :

- `Declarations_Beneficiaires` (update) vers `eclauses/beneficiaire/declarer/valide` ;
- `Declarations_Beneficiaires_Refus` (add) vers `eclauses/declaration/refusee`.

Le webhook `eclauses/marche/a_valider` est défini deux fois sur `Marches` (DEV et PROD) : l'acheteur peut recevoir le mail en double.

## Consultation des coordonnées

Le mail « un candidat a consulté vos coordonnées » (webhook `Acces_Coordonnees`, ajout) est envoyé à chaque bénéficiaire concerné. Le titre du marché doit être lu dans la ligne courante du lot de webhook, jamais par un index fixe comme `body[2]`.

