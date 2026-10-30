# Pièces jointes et CV

État décrit : PROD au 2026-10-30. Le flux ci-dessous fonctionne en PROD (testé avec un compte bénéficiaire).

## Principe : upload direct vers Grist, liaison par n8n

Le CV est une pièce jointe Grist, stockée dans `Beneficiaires.curriculum_vitae` (colonne de type `Attachments`, valeur `['L', id]`).

L'envoi du fichier se fait directement du widget vers Grist, sans proxy. En revanche, **la liaison du fichier à la ligne passe par n8n**.

Pourquoi : Grist refuse que la session du widget écrive l'identifiant d'une pièce jointe neuve dans une cellule (`[ACL_DENY] Cannot access attachment`). Pour un utilisateur qui n'est pas propriétaire du document, Grist n'accepte l'écriture que si la pièce jointe a été téléversée par la même session, ou si elle est déjà dans une cellule lisible. Or l'upload part d'une requête `fetch` avec jeton, et les bénéficiaires ne sont pas des comptes Grist (ils passent par `AuthLink`). Les propriétaires du document sont dispensés de ce contrôle, d'où le passage par n8n avec la clé propriétaire.

## Séquence

1. Le widget vérifie le fichier (type PDF, DOC ou DOCX, 5 Mo maximum).
2. Il demande un jeton en écriture :

```js
const tokenInfo = await grist.docApi.getAccessToken({ readOnly: false });
```

3. Il envoie le fichier. L'en-tête `X-Requested-With` est obligatoire, sans lui l'upload échoue :

```js
const formData = new FormData();
formData.append('upload', file, file.name);
const res = await fetch(`${tokenInfo.baseUrl}/attachments?auth=${tokenInfo.token}`, {
  method: 'POST',
  body: formData,
  headers: { 'X-Requested-With': 'XMLHttpRequest' }
});
```

4. Grist répond avec la liste des identifiants, par exemple `[131]`. Le fichier est stocké mais n'est lié à aucune ligne.
5. Le widget appelle le webhook n8n de liaison :

```js
fetch(gristAPI.getEnv('N8N_LIEN_CV'), {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ benef_id, attachment_id, token })
});
```

6. n8n vérifie la demande, puis écrit `['L', attachment_id]` dans `curriculum_vitae`.

## Webhook de liaison

| Élément | Valeur |
|---|---|
| Chemin | `eclauses/beneficiaire/cv/lier` (PROD) |
| Clé `Application_Env` | `N8N_LIEN_CV` |
| Entrée | `benef_id` (id de la ligne `Beneficiaires`), `attachment_id`, `token` |
| Réponse | 200 `{ "ok": true }` ; 400 requête invalide ; 403 refus |

Le `token` est le jeton de session `AuthLink`. Le widget le lit dans les paramètres d'URL (`Token_`), sinon dans `gristAPI.getAuth().token`. Cette seconde source suppose que la colonne `AuthLink.Token` soit lisible par la personne qui la possède (voir [47-permissions-acl.md](47-permissions-acl.md)).

n8n accepte la demande seulement si une requête SQL (`POST /api/docs/{docId}/sql`) confirme les quatre points :

- un `AuthLink` existe avec ce jeton, pour ce bénéficiaire, et n'est pas expiré ;
- le bénéficiaire existe et n'est pas marqué `Doit_supprimer` ;
- la pièce jointe a moins de 15 minutes (`_grist_Attachments.timeUploaded`) ;
- aucune ligne de `Beneficiaires` ne référence déjà cette pièce jointe.

Ces deux derniers contrôles empêchent d'attacher à son profil le fichier d'une autre personne.

Les nœuds HTTP de ce workflow utilisent un crédential `Bearer` contenant une clé API propriétaire. Un crédential limité est refusé (`insufficient document access`).

## Téléchargement et prévisualisation

Pour lire un fichier :

```js
const tokenInfo = await grist.docApi.getAccessToken({ readOnly: true });
const url = `${tokenInfo.baseUrl}/attachments/${id}/download?auth=${tokenInfo.token}`;
```

Limite connue, à tester : le jeton du widget ne porte pas les paramètres de lien (`LinkKey.Token`). Un accès qui dépend de `user.Auth` dans les règles d'accès peut donc être refusé au téléchargement.

La prévisualisation fonctionne pour les PDF. Pour les DOC/DOCX, afficher :

```text
Prévisualisation impossible. Le fichier a été téléchargé sur votre ordinateur.
```

## Suppression

Supprimer le CV consiste à écrire `['L']` dans la colonne. Cette écriture ne déclenche pas le contrôle d'accès aux pièces jointes. Grist supprime ensuite les pièces jointes non référencées.

## Anciennes versions

- L'ancien proxy `api/upload_cv.php` (PHP et Guzzle) et son flow n8n `eclauses/beneficiaire/upload/cv` ne sont plus utilisés. Le dossier `api/` a été supprimé du dépôt le 2026-10-30. Le flow n8n et la clé `N8N_CV_UPLOAD_URL` d'`Application_Env` existent encore en PROD ; le flow vise le document DEV.
- Un upload échoué laisse des pièces jointes orphelines. Elles sont nettoyées par Grist.
