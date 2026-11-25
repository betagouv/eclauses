# Runbook incidents

## Composant introuvable

Symptôme :

```text
Composant introuvable
```

Contrôles :

- vérifier `template_id` dans `Application_Composants` ;
- vérifier le paramètre `page`, `page_` ou `p` ;
- vérifier que le composant n'est pas seulement local et non déployé.

## Erreur Babel

Symptômes :

- plugin Babel invalide ;
- syntaxe JSX invalide ;
- import non supporté.

Contrôles :

- retirer les imports ESM ;
- exporter avec `Component` ou `module.exports` ;
- vérifier que le code ne dépend pas d'un package absent ;
- vérifier `getBabelTransformOptions()`.

## Page inaccessible

Contrôles :

- `requires_auth` ;
- `nav_roles` ;
- `AuthLink.Roles` ;
- espace actif dans `localStorage.activeSpace` ;
- `Eligible` et `Doit_supprimer`.

## Upload CV cassé

Le flux a deux étapes : upload direct dans Grist, puis liaison par le webhook n8n `cv/lier` (voir [48-pieces-jointes-et-cv.md](../40-modele-grist/48-pieces-jointes-et-cv.md)).

Contrôles :

- présence de `grist.docApi.getAccessToken` ;
- `requiredAccess: full` au `grist.ready()` ;
- réponse `/attachments?auth=...` contenant un ID attachment (par exemple `[131]`), avec l'en-tête `X-Requested-With` ;
- clé `N8N_LIEN_CV` présente dans `Application_Env` ;
- jeton de session disponible côté widget (`Token_` dans l'URL, sinon `getAuth().token`, qui exige la colonne `Token` lisible dans l'ACL d'`AuthLink`) : message « Session expirée, veuillez vous reconnecter » sinon ;
- exécution n8n du workflow `cv/lier` : le nœud SQL en erreur `insufficient document access` signale un crédential sans droit propriétaire ;
- réponse 403 « Ajout du CV refusé » : le jeton, le bénéficiaire ou la pièce jointe ne passent pas la vérification. Regarder la sortie du nœud SQL (`auth_id`, `benef_id`, `att_id`, `att_refs`) ;
- pièce jointe plus vieille que 15 minutes ou déjà référencée.

Symptôme : pièces jointes dans `_grist_Attachments` mais aucune ligne de `Beneficiaires` ne les référence. La liaison n'a pas eu lieu. Si le widget tente d'écrire lui-même `['L', id]`, Grist répond `[ACL_DENY] Cannot access attachment` pour un utilisateur non propriétaire.

## Mails au libellé « lot » incorrect

Symptôme : un mail parle d'un lot, ou répète « Lot - titre », alors que le marché n'a pas de lot.

Contrôles :

- le webhook Grist qui déclenche le mail et la table concernée (`Marches`, `Invitation_Titulaire`, `Declarations_Beneficiaires`) ;
- les champs réellement présents dans ce payload (le mail n'affiche rien pour un champ absent) ;
- `Est_lot`, `Nb_lots`, `Lot_Label` sur la ligne du marché ;
- les formules `Clauses_sociales_lots`, `Clauses_sociales_parent_ou_enfants` et `Lots_Detail` pour un marché sans lot ;
- la version du workflow n8n déployée (voir [deploiement/correctifs-mails-sans-lot.md](../../deploiement/correctifs-mails-sans-lot.md)).

## Webhook n8n en erreur

Contrôles :

- clé `Application_Env` ;
- URL DEV/PROD ;
- payload envoyé ;
- document ID dans le node Grist ;
- droits du credential Grist ;
- node email ;
- idempotence en cas de retry.

