# Phases 4 et 6 : stockage de fichiers et import des données Grist

Branche `rewrite-postgres`.

## Phase 4 : fichiers

- **Interface `FileStore`** (`put`, `get`, `delete`, `exists`) ; pilotes `local` (dossier, écriture atomique, clés refusées si absolues, avec `..` ou NUL) et `s3` (`@aws-sdk/client-s3`, Scaleway Object Storage ou tout service compatible). Le choix se fait par `STORAGE_DRIVER` ; variables S3 dans `.env.example`. Aucun code métier ne change entre les deux.
- **Test de contrat commun** (`tests/storage.test.ts`) : la même suite tourne sur le pilote local et sur un **vrai MinIO** (`docker compose --profile s3 up -d minio`, variables `S3_TEST_*`) : relecture à l'identique, clé absente, écrasement, suppression idempotente, fichier vide. Sans `S3_TEST_ENDPOINT`, la partie S3 est ignorée. Un défaut a été trouvé et corrigé : une clé absolue n'était pas refusée (elle restait dans la racine, sans évasion, mais elle est maintenant rejetée).
- **Docker** : l'image applique les migrations au démarrage (`migrate.mjs`, sans `tsx`), garde les fichiers dans `/data/fichiers` (volume `fichiers` dans `docker-compose.yml`) et tourne toujours en utilisateur non root, système de fichiers en lecture seule, sans capacité Linux. Vérifié sur une base vierge : 33 tables créées, conteneur sain, CV déposé et écrit dans le volume.
- **Tâche `purge-fichiers`** : supprime les fichiers jamais rattachés à une fiche depuis plus d'un jour (dépôt interrompu). Testée.

## Phase 6 : import de Grist

`apps/web/scripts/import-grist.ts` (options `--replace`, `--keep-pending-notifications`, `--allow-remote-target`).

- **Lecture seule côté Grist** (documents DEV ou PROD au choix de `GRIST_DOC_ID`) ; aucune écriture, aucun webhook touché.
- **Cible** : refuse toute base non locale sans `--allow-remote-target` ; `--replace` (vidage des tables métier) est interdit sur une cible distante.
- **Rejouable sans doublon** (mise à jour par `grist_id`) : deux imports de suite donnent exactement les mêmes comptes, avec les mêmes fichiers.
- Reprend les référentiels, clauses, acheteurs et utilisateurs, répondants, bénéficiaires (listes, CV copiés dans le stockage configuré), marchés (parents puis lots), spécialités, candidatures, déclarations, refus, intérêts, accès, invitations, FAQ, vidéos, indicateurs, liens et textes du site. Les mots de passe existants (SHA-256 historique) sont repris tels quels et remplacés par scrypt à la première connexion.
- **Courriers déjà partis** : par défaut, tous les marchés parents sont marqués « publication déjà notifiée », et les états déjà atteints (à valider, validée, déclaration validée) sont marqués envoyés : une première modification ne renvoie pas l'historique. `--keep-pending-notifications` laisse les publications en attente.
- **Rapport** : comptes source et cible par table, et avertissements regroupés.

### Parité des formules : `scripts/verify-import.ts`

Compare, sur les données importées, 2027 valeurs que Grist calculait (lots, statut global, intitulés, libellés, candidats, déclarations par marché, clauses, éligibilité, suppression, archivage, libellés de répondant, adresses d'envoi, indicateurs) avec ce que la nouvelle couche calcule : **0 écart** sur le DEV. Les seules différences tolérées sont des présentations : « 83.0 % » devient « 83 % » et l'API REST de Grist n'encode pas les dictionnaires (on compare le nombre de lots décrits).

### Résultat sur le DEV (document `<ID du document DEV>`)

Tous les effectifs correspondent (275 bénéficiaires, 128 acheteurs, 27 marchés, 20 déclarations, etc.). Points relevés à traiter dans les données :

| Constat | Détail |
|---|---|
| 269 bénéficiaires sans e-mail | Importés sans compte : visibles dans l'annuaire, sans connexion possible. À décider avec l'équipe (invitation par un autre canal, ou purge). |
| 43 CV sur 50 non copiés | Grist répond HTTP 500 au téléchargement de ces pièces jointes (fichiers absents côté DEV). Les 7 autres sont copiés. À refaire sur PROD, où les pièces jointes sont réelles. |
| 1 répondant en doublon | Deux répondants avec la même adresse : le second est importé sans compte. À fusionner dans Grist. |
| 2 comptes de connexion sans profil | Non importés (adresses personnelles masquées dans le rapport). |
| 1 département hors référentiel | « hors France » n'a pas de région. |

Réponses aux points laissés ouverts en phase 1 : `Marches.Suivi` est vide dans le DEV (conservé tel quel) ; `Courriel_Eclauses` n'existe pas ; `Clef_secrete` n'est pas reprise ; les documents des clauses sont vides (non repris) ; les bénéficiaires sans e-mail n'ont pas de compte, comme prévu ; la formule `Tagline` n'est pas utilisée (le texte brut est repris s'il existe).

## Vérifié

- Tests : 96, dont 11 de stockage (local et MinIO) et 1 de purge des fichiers ; `tsc` et `next build` propres.
- Import DEV → PostgreSQL local, deux fois de suite ; vérification de parité à 0 écart.
- Image Docker : migrations sur base vierge, démarrage sain, dépôt de CV dans le volume, smoke HTTP.

## Pas fait

- **Import de PROD** : non lancé (la lecture de PROD est permise, l'écriture n'est jamais dans PROD ; l'import vers une base de production demande une validation et une fenêtre de bascule).
- **Bascule** : plan de coupure, gel de Grist, courriers, DNS et reprise des mots de passe sont à écrire avec l'équipe (phase 9).
- **Fichiers de la PROD sur S3** : le pilote est prêt et testé sur MinIO, pas sur Scaleway.

## Import de la PROD (lecture seule) et ce qu'il a révélé

Le document PROD (`<ID du document PROD>`) a été lu en **lecture seule** et copié dans une base locale distincte (`eclauses_prod_copy`, port 5434), ses CV dans `apps/web/var/fichiers-prod` (ignoré par git). Ces deux emplacements contiennent des **données personnelles réelles** : à supprimer quand l'essai est terminé (`docker exec eclauses-db-1 psql -U eclauses -d postgres -c "drop database eclauses_prod_copy"` et suppression du dossier).

| Table | Grist PROD | PostgreSQL | Remarque |
|---|---|---|---|
| Bénéficiaires | 365 | 365 | 64 sans e-mail (sans compte), 2 doublons d'e-mail |
| Marchés | 33 | 33 | parents et lots |
| Déclarations | 15 | 15 | dont 3 saisies par l'équipe, sans répondant |
| Intérêts | 64 | 64 | |
| CV | 59 | 59 | tous copiés (en DEV, 43 sur 50 étaient illisibles) |
| Acheteurs / utilisateurs acheteurs | 126 / 56 | 126 / 54 | 2 utilisateurs sans e-mail non importés |
| Répondants | 16 | 16 | |
| Comptes de connexion | 128 | 122 adresses utilisées | les autres n'ont pas de profil ou sont des doublons d'adresse |

### Les formules ne sont pas les mêmes en DEV et en PROD

La comparaison automatique des deux documents montre 18 formules différentes et des dizaines de colonnes propres à l'un ou à l'autre. Le code a été aligné sur la **PROD**, qui est ce que le nouveau système remplace :

| Sujet | DEV | PROD (retenu) |
|---|---|---|
| Libellé d'un répondant (`Label`) | raison sociale + nom + e-mail | raison sociale, sinon e-mail |
| Répondant à supprimer | 5 ans après la dernière mise à jour du compte | 5 ans après la **dernière connexion** (jamais connecté : conservé) |
| `Clauses_sociales.Beneficiaires` | seulement les fiches à jour | **tous** les bénéficiaires rattachés (la liste « actifs » reste filtrée) |
| Destinataires d'une publication | bénéficiaires actifs | tous les rattachés aux clauses du marché et de ses lots |
| Durée des liens par courrier | 24 h | 30 jours pour tous |

Deux écarts volontaires par rapport à la PROD, à valider :
- **Publication** : en plus du rattachement, un destinataire doit avoir une adresse, être éligible et ne pas être à supprimer (la PROD écrit aussi aux bénéficiaires hors durée de conservation).
- **Liens de réinitialisation** : 24 h (activation : 30 jours), car un lien de mot de passe qui dure un mois est un risque inutile.

### Défaut du modèle trouvé et corrigé

Trois déclarations de la PROD n'ont **pas de répondant** (saisies par l'équipe) : la colonne était obligatoire. Migration `0004` (colonne facultative), lecture adaptée, test ajouté. Un nouvel indicateur (« profils uniques de bénéficiaires ») a aussi été ajouté.

### Parité

2815 comparaisons entre ce que la PROD calcule et ce que le nouveau code calcule : **1 écart expliqué** (l'adresse d'un bénéficiaire en doublon, importé sans compte). Les différences de présentation tolérées sont les mêmes qu'en DEV, plus le retrait des espaces de fin de texte.

### À savoir sur l'outillage

Le processus d'import ne se terminait pas seul après la fin du travail (connexions HTTP persistantes vers Grist) : il sort maintenant explicitement. **Ne jamais lancer deux imports `--replace` en même temps sur la même base** : le second vide les tables du premier.
