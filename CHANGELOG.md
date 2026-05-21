# Changelog Eclauses (app)

## Unreleased

### Corrections de bugs (2026-01-05)
- **Bug #97** : Correction du scroll bloqué dans les listes de spécialités et régions (bénéficiaire-profil). Suppression du handler `onWheel` qui empêchait le défilement naturel des combobox.
- **Bug #96** : Correction de l'impossibilité de sélectionner les régions de mobilité (bénéficiaire-profil). Amélioration de la gestion des événements dans les combobox.
- **Bug #101** : Correction du `#KeyError` lors de la sélection des départements de résidence (bénéficiaire-profil). Remplacement du `<select multiple>` par un combobox personnalisé avec gestion correcte des IDs numériques pour les ReferenceList Grist.
- **Bug #102** : Correction du `#IndexError` lors de l'upload de CV (bénéficiaire-profil). Renforcement de la gestion des attachments avec nettoyage robuste des listes et conversion sécurisée des IDs.
- **Bug #91** : Correction de l'affichage des points (markers) sur la carte des marchés (bénéficiaire-marches). Les coordonnées invalides ou (0,0) sont maintenant exclues. Amélioration du centrage par défaut sur la France entière. Les marchés sans coordonnées valides génèrent un avertissement console.

### Améliorations précédentes
- Bénéficiaire profil : sécurisation du stockage CV (IDs numériques uniquement) pour éviter les erreurs `KeyIndex` sur `curriculum_vitae`.
- Combobox profil : capture du scroll dans les listes Spécialités/Régions pour éviter le défilement de la page ; nettoyage des listes (sentinelle) et sauvegarde des départements alignée ChoiceList.
- Marchés bénéficiaire : titres de champs en gras dans la modale (#94).
- Menu mobile : le burger affiche désormais les espaces accessibles (rôles) et le bouton connexion/déconnexion.
- Acheteur annuaire : popups des cartes résidences/mobilités listent les bénéficiaires du point et ouvrent la fiche en modale au clic (#20).
- FAQ : catégories vides masquées selon le filtre/rôle (#92), fallback sur "Toutes les catégories" si la catégorie sélectionnée n'a plus de questions.
