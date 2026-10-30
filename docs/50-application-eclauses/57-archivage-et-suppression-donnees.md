# Archivage et suppression des données

## Marchés

Un marché doit passer au statut `Archivé` 6 mois après la date de fin d'exécution prévisionnelle.

Dans le modèle multi-lots :

- la date est portée par le lot ou par le parent non alloti ;
- le parent peut être considéré archivé quand tous les lots sont archivés.

## Bénéficiaires

Règles métier :

- fin d'éligibilité : 5 ans après la diplomation + 6 mois de tampon ;
- non visible dans l'annuaire après fin d'éligibilité ;
- plus d'accès à l'espace bénéficiaire si non éligible ;
- conservation back-office 5 ans après fin d'éligibilité ;
- suppression des données personnelles après 10 ans, sans suppression de la ligne.

Quand `Doit_supprimer` est vrai :

- remplacer le nom par `Bénéficiaire #ID` ;
- vider les données personnelles ;
- conserver les références ;
- supprimer le compte `AuthUser`.

## Candidats et titulaires

Règles prévues :

- candidats : suppression logique 5 ans après dernière connexion ;
- titulaires : suppression logique 5 ans après validation de la clause sociale.

Même principe : vider les données personnelles, conserver la ligne et les références, supprimer le compte `AuthUser`.

