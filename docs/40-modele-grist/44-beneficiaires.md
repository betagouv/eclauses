# Bénéficiaires

La table `Beneficiaires` porte les profils visibles dans les annuaires et utilisés dans les déclarations.

## Affichage annuaire

Un bénéficiaire est affichable si :

- il est `Eligible` ;
- il n'a pas `Doit_supprimer` ;
- il respecte les filtres de la page ;
- les règles de consentement permettent d'afficher ou non les coordonnées.

Si la personne ne souhaite pas être contactée pour rejoindre un groupement, les coordonnées doivent être masquées et le message suivant affiché :

```text
Cette personne ne souhaite pas être contactée pour rejoindre un groupement.
```

## CV

Le CV est stocké comme attachment Grist dans une colonne ref-list, généralement `curriculum_vitae`.

Côté profil bénéficiaire, le fichier est envoyé directement à Grist par le widget (`/attachments`), puis lié à la ligne par un webhook n8n (`N8N_LIEN_CV`), car Grist refuse cette liaison depuis la session du widget. Le détail est dans [48-pieces-jointes-et-cv.md](48-pieces-jointes-et-cv.md).

La lecture utilise :

```text
/attachments/{id}/download?auth={token}
```

## Éligibilité et suppression

Règles métier prévues :

- un bénéficiaire devient non éligible 5 ans après la date de diplomation, avec 6 mois de tampon ;
- les données restent conservées côté back-office 5 ans après la fin d'éligibilité ;
- après 10 ans, les données personnelles sont supprimées mais la ligne reste ;
- les statistiques publiques doivent compter uniquement les bénéficiaires éligibles.

