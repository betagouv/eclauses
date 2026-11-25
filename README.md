# Eclauses

> Plateforme de suivi des clauses sociales des marchés publics du ministère de la Culture.

[Eclauses](https://eclauses.beta.gouv.fr) met en relation des candidats à des marchés publics et des bénéficiaires de clauses sociales portées par le ministère de la Culture. La clause vise à **favoriser l'insertion professionnelle des néo-diplômés en conservation-restauration de biens culturels**, et à renforcer la transmission des savoir-faire dans les équipes titulaires.

C'est un produit [beta.gouv.fr](https://beta.gouv.fr) (Atelier numérique de la Culture et Mission ministérielle des achats).

## Fonctionnalités

Trois espaces, selon le rôle de la personne connectée :

- **Bénéficiaires** : renseigner son profil, consulter les marchés couverts par la clause, manifester son intérêt, parcourir l'annuaire.
- **Candidats et titulaires (répondants)** : candidater, rechercher des bénéficiaires, déclarer le bénéficiaire retenu.
- **Acheteurs** : déclarer et publier les marchés, inviter les titulaires, valider les déclarations, consulter l'annuaire et les statistiques.

Des pages publiques complètent l'ensemble : accueil, support (FAQ et contact), statistiques, mentions légales, politique de confidentialité, accessibilité.

## Architecture

Cette branche (`main`) correspond à la version en production :

| Brique | Rôle | Hébergement |
|---|---|---|
| `index.html` | Page publique qui encapsule l'iframe Grist | Fichier statique, AlwaysData |
| Grist | Base de données, règles d'accès, pages | Instance Grist de la DINUM |
| `grist-dsfr-react-app/` | Widget React + [DSFR](https://www.systeme-de-design.gouv.fr/) qui charge les pages | Dans Grist |
| `grist/page/`, `grist/composants/` | Pages et composants React, stockés dans la table `Application_Composants` | Dans Grist |
| n8n | Courriers transactionnels, authentification, relances | Instance de l'ANCT |
| Scaleway | Envoi des courriers | Relais SMTP |

Les pages ne sont pas compilées : ce sont des extraits React chargés par le widget. Beaucoup n'ont volontairement pas d'extension `.js`.

Une réécriture (Next.js, TypeScript, PostgreSQL) est développée sur la branche `rewrite-postgres`.

## Documentation

La documentation technique est dans [`docs/`](docs/README.md) : vue d'ensemble, front, widget, modèle Grist, application, automatisations n8n, déploiement et maintenance.

## Développement

Prérequis : accès à l'instance Grist (document de développement) et à l'instance n8n de recette.

1. Copier le fichier `.gristkey` (non versionné) avec les clés d'API Grist DEV et PROD. Il est ignoré par git : ne le commitez jamais.
2. Modifier les pages dans `grist/page/` ou `grist/composants/`.
3. Publier le code d'une page en le collant dans la table `Application_Composants` de Grist, depuis l'interface Grist (l'écriture par l'API peut être refusée par le pare-feu).
4. Tester sur l'environnement de recette : <https://dev-eclauses.incubateur.net>.

Règles à respecter :

- ne jamais modifier la production sans validation explicite ;
- préférer les motifs DSFR existants aux composants maison ;
- vérifier libellés, états désactivés, retours de succès et affichage mobile pour tout bouton ou modale.

Le suivi des changements est dans [CHANGELOG.md](CHANGELOG.md).

## Mise en production

La procédure et la checklist sont décrites dans [`docs/70-deploiement-maintenance/`](docs/70-deploiement-maintenance/71-checklist-deploiement-dev-prod.md). Les flux n8n de la production ne se modifient qu'après validation.

## Sécurité et données personnelles

- Les données personnelles sont traitées pour mettre en relation candidats et bénéficiaires ; seuls les bénéficiaires ayant consenti figurent dans l'annuaire. Détails dans la politique de confidentialité du site.
- Pour signaler une vulnérabilité, écrire à contact@eclauses.beta.gouv.fr sans rendre le problème public.

## Contribuer

Les contributions passent par des pull requests sur ce dépôt. Décrivez le contexte, ce qui change et comment le tester.

## Contact

[contact@eclauses.beta.gouv.fr](mailto:contact@eclauses.beta.gouv.fr)

## Licence

Aucune licence n'est encore déclarée dans ce dépôt. À préciser avec le ministère de la Culture avant toute réutilisation.
