# Déploiement de développement (Docker, serveur distant)

Application publiée derrière un proxy inverse HTTPS qui transmet à `DEPLOY_BIND:3200`. Les valeurs propres à votre serveur (hôte, clé SSH, adresse) sont dans `infra/dev-sandbox/deploy.env`, ignoré par git : voir `deploy.env.example`.
Base PostgreSQL et fichiers : volumes Docker du projet `eclauses-dev`. Courriers : mode journal (aucun envoi réel).

## Commandes (depuis la racine du dépôt)
- `infra/dev-sandbox/deploy.sh` : construit l'image amd64 sur le poste, l'envoie sur le serveur, relance la pile (migrations au démarrage).
- `infra/dev-sandbox/deploy.sh status` / `logs` : état et journaux.
- `infra/dev-sandbox/deploy.sh tunnel` : tunnel SSH vers la base (localhost:5436), pour importer ou inspecter.
- Courriers « envoyés » : `ssh … 'cd eclauses-dev && docker compose logs web | grep mail:journal'`.

## Réimporter Grist DEV (lecture seule côté Grist)
1. `deploy.sh tunnel` dans un terminal.
2. Dans un autre, depuis `apps/web`, avec le mot de passe de la base lu sur le serveur (`eclauses-dev/.env`) :
   `DATABASE_URL=postgres://eclauses:<mot de passe>@127.0.0.1:5436/eclauses STORAGE_LOCAL_DIR=/tmp/fichiers-dev npx tsx scripts/import-grist.ts [--replace]`
3. Copier les CV : `tar --no-mac-metadata -C /tmp/fichiers-dev -cf - . | ssh … "docker run --rm -u 0 --entrypoint sh -v eclauses-dev_fichiers:/data -i eclauses-web:dev -c 'mkdir -p /data/fichiers && tar xf - -C /data/fichiers && chown -R app:app /data/fichiers'"`.

## Premier administrateur
Depuis `apps/web`, via le tunnel, avec l'adresse publique pour que le lien d'activation soit correct :
`PUBLIC_URL=https://<adresse-publique> DATABASE_URL=… npx tsx scripts/create-admin.ts prenom.nom@exemple.fr`
