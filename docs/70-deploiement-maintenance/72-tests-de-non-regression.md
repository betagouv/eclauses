# Tests de non-régression

## Runtime widget

- Charger la home publique sans token.
- Charger une page protégée sans token : afficher l'accès restreint.
- Charger avec un token valide.
- Changer d'espace si plusieurs rôles sont disponibles.
- Ouvrir/fermer le menu connecté.
- Ouvrir le menu mobile.
- Naviguer avec `data-nav`.
- Tester une ancre `data-anchor`.

## Marchés acheteur

- Créer un marché non alloti : aucun lot enfant créé.
- Créer un marché alloti : parent + lots enfants créés.
- Modifier un marché en préparation.
- Modifier un lot et enregistrer le lot.
- Supprimer un lot en préparation.
- Déclarer la publication.
- Copier le lien candidat.
- Consulter la fiche détail.
- Déclarer un titulaire marché non alloti.
- Déclarer les titulaires par lot.
- Vérifier le parent tant que tous les titulaires ne sont pas déclarés.
- Relancer un titulaire.
- Voir la date de dernière relance.

## Candidat / titulaire

- Ouvrir une inscription avec marché parent alloti.
- Sélectionner plusieurs lots.
- Ouvrir une inscription avec marché non alloti : pas de case à décocher.
- Afficher les lots candidats.
- Afficher les lots titulaires dans l'ordre métier.
- Déclarer des bénéficiaires.
- Voir un refus et son motif.

## Validation acheteur

- Ouvrir une déclaration à valider.
- Cocher les confirmations sans retour scroll en haut.
- Valider avec bénéficiaire Eclauses.
- Valider avec bénéficiaire externe.
- Refuser avec motif obligatoire.
- Vérifier retour en brouillon côté répondant.

## Annuaires

- Exclure `Eligible = false`.
- Exclure `Doit_supprimer = true`.
- Masquer coordonnées si refus contact groupement.
- Afficher badge `Intérêt exprimé`.
- Vérifier tooltip spécialités dans `ComboBox`.

## CV

- Upload PDF.
- Upload DOC/DOCX.
- Refuser type non autorisé.
- Refuser fichier trop lourd.
- Prévisualiser PDF.
- Afficher message de non-prévisualisation DOC/DOCX.
- Vérifier, après l'upload, que `curriculum_vitae` contient l'ID de la nouvelle pièce jointe (la liaison passe par n8n).
- Tester en navigation privée avec un compte bénéficiaire (visiteur sans compte Grist).
- Vérifier qu'un acheteur ouvre le CV d'un bénéficiaire qui consent à l'annuaire, et pas celui d'un bénéficiaire qui ne consent pas.

## Mails

Pour chaque mail, tester un marché sans lot et un marché avec lots, avec des adresses de test :

- publication d'un marché (mail aux bénéficiaires) : objet, introduction, bloc « Lots concernés » ou « Clause sociale » ;
- invitation d'un titulaire et relance : lignes « Marché » et « Lot », objet ;
- déclaration à valider, clause validée, bénéficiaire déclaré, déclaration refusée ;
- consultation des coordonnées : 1 puis 3 consultations dans la même minute, le titre doit être celui du bon marché ;
- publication d'un marché sans bénéficiaire actif : aucun mail ni erreur.

