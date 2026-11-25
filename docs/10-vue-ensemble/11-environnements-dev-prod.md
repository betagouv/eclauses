# Environnements DEV et PROD

## Références connues

Les identifiants des documents ne sont pas versionnés (dépôt public) : ils sont conservés hors du dépôt et doivent toujours être vérifiés avant usage.

| Environnement | Document Grist connu |
|---|---|
| DEV | identifiant dans `AGENTS.md` / `.gristkey` (non versionnés) |
| PROD | identifiant dans `AGENTS.md` / `.gristkey` (non versionnés) |

Exports n8n locaux :

- DEV : [n8n/DEV - Eclauses.json](../../n8n/DEV%20-%20Eclauses.json)
- PROD : [n8n/Eclauses - PROD.json](../../n8n/Eclauses%20-%20PROD.json)

Checklist de migration :

- [deploiement/todo-deploiement-dev-prod.md](../../deploiement/todo-deploiement-dev-prod.md)

## Différences attendues

Certaines différences ne sont pas des anomalies :

- document ID Grist différent ;
- chemins webhooks DEV/PROD différents ;
- URLs contenant `eclauses-dev` en DEV et `eclauses` en PROD ;
- IDs internes n8n différents ;
- suffixes de noms de nodes générés par n8n.

## Règles de sécurité production

- Ne jamais supprimer de données, tables, colonnes, webhooks, attachments, composants ou workflows en production.
- Toute modification PROD via MCP Grist, n8n ou import manuel doit être validée explicitement par l'utilisateur.
- L'inspection read-only est autorisée.
- Si l'environnement cible est ambigu, considérer qu'il s'agit de la production jusqu'à preuve du contraire.

## Stratégie documentaire

Chaque chapitre qui décrit une fonctionnalité en cours de migration doit préciser :

- état local/DEV ;
- état PROD si connu ;
- impact de migration ;
- vérification nécessaire avant déploiement.

