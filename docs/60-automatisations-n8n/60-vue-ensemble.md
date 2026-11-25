# Automatisations n8n

Les workflows n8n complètent Grist pour les traitements serveur :

- création et activation de comptes ;
- envoi d'emails ;
- relances ;
- notifications de publication ;
- notifications de déclaration ;
- archivage et suppression logique.

Exports locaux :

- DEV : [n8n/DEV - Eclauses.json](../../n8n/DEV%20-%20Eclauses.json)
- PROD (juillet 2026) : [n8n/Eclauses - PROD.json](../../n8n/Eclauses%20-%20PROD.json)
- PROD avec le flux `cv/lier` et les correctifs de mails des marchés sans lot (à déployer) : `n8n/PROD - Eclauses - corrige mails.json`

Pour mettre à jour un workflow existant sans le dupliquer, ouvrir ce workflow dans n8n puis utiliser « Import from File » depuis son menu. L'import depuis la liste des workflows crée un nouveau workflow dont les chemins de webhook entrent en conflit avec l'ancien.

Un crédential `Bearer` propriétaire est nécessaire pour les nœuds HTTP vers Grist (points d'accès SQL et `/attachments`).

## Différences normales DEV/PROD

- ID document Grist ;
- URLs `eclauses-dev` vs `eclauses` ;
- chemins webhook ;
- IDs internes n8n ;
- suffixes automatiques de nodes.

## Règle de documentation

Chaque workflow doit être documenté avec :

- déclencheur ;
- payload entrant ;
- tables Grist lues ;
- tables Grist écrites ;
- email envoyé ;
- conditions d'erreur ;
- idempotence ou risque de doublon.

