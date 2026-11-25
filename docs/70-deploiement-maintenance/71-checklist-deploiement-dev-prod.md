# Checklist de déploiement DEV vers PROD

Cette checklist complète [deploiement/todo-deploiement-dev-prod.md](../../deploiement/todo-deploiement-dev-prod.md).

## Grist structure

- [ ] Exporter le schéma DEV.
- [ ] Exporter le schéma PROD.
- [ ] Comparer les tables.
- [ ] Comparer les colonnes.
- [ ] Identifier les formules.
- [ ] Identifier les colonnes ref/ref-list.
- [ ] Vérifier les ACL.
- [ ] Préparer les ajouts sans suppression.
- [ ] Faire valider toute modification PROD.

## Application_Composants

- [ ] Lister les `template_id` DEV.
- [ ] Lister les `template_id` PROD.
- [ ] Identifier les pages absentes PROD.
- [ ] Identifier les composants partagés absents PROD.
- [ ] Comparer le code des pages modifiées.
- [ ] Déployer d'abord en DEV.
- [ ] Tester le runtime.
- [ ] Faire valider le push PROD.

## Application_Env

- [ ] Comparer les clés DEV/PROD.
- [ ] Vérifier les URLs webhooks.
- [ ] Vérifier `DEBUG`.
- [ ] Vérifier les délais de relance.
- [ ] Ne jamais copier une URL DEV en PROD.

## n8n

- [ ] Comparer exports DEV/PROD.
- [ ] Ignorer les différences normales d'ID.
- [ ] Vérifier document ID Grist par node.
- [ ] Vérifier les chemins webhooks.
- [ ] Vérifier les emails et accents.
- [ ] Vérifier les payloads multi-lots.
- [ ] Tester chaque webhook en DEV.
- [ ] Importer/activer en PROD uniquement après validation.

## Wrapper public

- [ ] Vérifier `data-src`.
- [ ] Vérifier document ID cible.
- [ ] Vérifier propagation `Token_`, `page_`, `marche_`.
- [ ] Tester mobile et desktop.
- [ ] Tester logout et nettoyage cookie.

## Tests métier

- [ ] Login et espaces multi-rôles.
- [ ] Création marché non alloti.
- [ ] Création marché alloti.
- [ ] Modification lots.
- [ ] Publication parent.
- [ ] Inscription candidat multi-lots.
- [ ] Déclaration titulaire par lot.
- [ ] Déclaration bénéficiaires.
- [ ] Validation.
- [ ] Refus.
- [ ] Relance.
- [ ] Upload CV (fichier envoyé, puis lié à la ligne par le webhook `cv/lier`).
- [ ] Clé `N8N_LIEN_CV` dans `Application_Env` et crédential `Bearer` propriétaire dans n8n.
- [ ] Webhooks Grist `declarer/valide` et `declaration/refusee` créés en PROD.
- [ ] Un seul webhook Grist vers `marche/a_valider`.
- [ ] Mails des marchés sans lot : publication, invitation, déclaration, validation, relance.
- [ ] Annuaires et masquage coordonnées.
- [ ] Bénéficiaires non éligibles.

