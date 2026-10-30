# Contrats d'entrée et sortie n8n

Chaque workflow doit avoir un contrat documenté.

## Template de documentation

```md
## Nom du workflow

Déclencheur :

Webhook :

Environnement :

Payload entrant :

Tables lues :

Tables écrites :

Emails envoyés :

Réponse HTTP :

Gestion des erreurs :

Idempotence :

Différences DEV/PROD :
```

## Liaison du CV

Déclencheur : le widget `beneficiaire-profil`, après l'upload du fichier dans Grist.

Webhook : `eclauses/beneficiaire/cv/lier` (clé `Application_Env` : `N8N_LIEN_CV`).

Payload entrant : `benef_id` (entier), `attachment_id` (entier), `token` (jeton `AuthLink`, 20 à 64 caractères).

Tables lues : `AuthLink`, `Beneficiaires`, `_grist_Attachments` (requête SQL en une fois).

Tables écrites : `Beneficiaires.curriculum_vitae` (`['L', attachment_id]`, via `PATCH /tables/Beneficiaires/records`).

Réponse HTTP : 200 `{ "ok": true }` ; 400 requête invalide ; 403 `{ "ok": false, "message": ... }` si le jeton, le bénéficiaire ou la pièce jointe ne sont pas valides.

Gestion des erreurs : aucune écriture si une vérification échoue ; le widget affiche le `message` de la réponse.

Idempotence : une pièce jointe déjà référencée est refusée. Relancer avec le même identifiant échoue donc après un premier succès.

Différences DEV/PROD : document Grist, chemin `eclauses-dev` ou `eclauses`, et crédential `Bearer` avec une clé propriétaire du document.

## Webhooks Grist vers n8n (PROD)

| Table | Événement | Chemin n8n |
|---|---|---|
| `Application_Password_Reset` | add | `password/send-link` |
| `Repondants` | add | `candidat/inscription` |
| `Invitation_Titulaire` | add | `titulaire/invitation` |
| `Marches` | update | `notification/marche-publie` |
| `Marches` | update | `marche/a_valider` (défini deux fois) |
| `Marches` | update | `marche/validee` |
| `Acces_Coordonnees` | add | `notification/consultation-coordonnees` |
| `ActionsManuelles` | update | `compte/invitation` |
| `Declarations_Beneficiaires` | update | `beneficiaire/declarer/valide` (manquant en PROD au 2026-10-30) |
| `Declarations_Beneficiaires_Refus` | add | `declaration/refusee` (manquant en PROD au 2026-10-30) |

Un webhook Grist envoie un tableau `body` avec les lignes concernées et toutes les colonnes de la table. Les flux actuels ne lisent que `body[0]`.

Les appels du widget (`login`, `reset`, `support`, `relance`, `candidat/check`, `cv/lier`) viennent de clés `Application_Env`.

## Données recommandées

Pour les emails multi-lots, préparer les champs suivants avant le node email :

- `Marche_Label` ;
- `Lot_Label` ;
- `Acheteur_Label` ;
- `Titulaire_Label` ;
- `Lots_Detail_HTML` ;
- `Lien_Activation` ;
- `Lien_Connexion`.

Cela rend les templates plus lisibles et limite les expressions imbriquées dans le HTML.

