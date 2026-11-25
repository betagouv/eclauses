#!/usr/bin/env bash
# Déploie l'application sur un serveur Docker distant (SSH) depuis ce poste.
#   infra/dev-sandbox/deploy.sh init <url-publique>   # première fois : dossier distant + .env avec secrets générés
#   infra/dev-sandbox/deploy.sh                       # construit l'image (amd64), l'envoie et relance
#   infra/dev-sandbox/deploy.sh status | logs | tunnel
# Configuration : copier infra/dev-sandbox/deploy.env.example en infra/dev-sandbox/deploy.env (ignoré par git) et le remplir.
#   DEPLOY_HOST (obligatoire, utilisateur@serveur), DEPLOY_KEY (défaut ~/.ssh/id_rsa), DEPLOY_DIR (défaut eclauses-dev),
#   DEPLOY_BIND (adresse d'écoute de l'application sur le serveur, défaut 127.0.0.1).
set -euo pipefail
cd "$(dirname "$0")/../.."
[ -f infra/dev-sandbox/deploy.env ] && . infra/dev-sandbox/deploy.env
HOST="${DEPLOY_HOST:?DEPLOY_HOST manquant : voir infra/dev-sandbox/deploy.env.example}"
KEY="${DEPLOY_KEY:-$HOME/.ssh/id_rsa}"
DIR="${DEPLOY_DIR:-eclauses-dev}"
SSH=(ssh -o BatchMode=yes -o IdentitiesOnly=yes -i "$KEY" -o ControlPath=none -o ServerAliveInterval=15 -o ServerAliveCountMax=8 "$HOST")
remote() { "${SSH[@]}" "$@"; }

case "${1:-deploy}" in
  init)
    url="${2:?usage : deploy.sh init https://adresse-publique}"
    remote "mkdir -p $DIR"
    if remote "test -f $DIR/.env"; then echo ".env existe déjà : conservé."; else
      remote "umask 077 && cat > $DIR/.env <<ENV
POSTGRES_PASSWORD=\$(openssl rand -hex 24)
MFA_ENCRYPTION_KEY=\$(openssl rand -hex 32)
CRON_SECRET=\$(openssl rand -hex 24)
PUBLIC_URL=$url
TRUSTED_PROXIES=1
WEB_PORT=3200
WEB_BIND=${DEPLOY_BIND:-127.0.0.1}
ENV"
      echo ".env créé sur le serveur (secrets générés là-bas, jamais affichés)."
    fi ;;
  deploy)
    docker buildx build --platform linux/amd64 -t eclauses-web:dev --load .
    # Transfert en fichier, reprenable : après une coupure du VPN, on reprend à la taille déjà reçue (pas de rsync sur le serveur).
    archive="$(mktemp -t eclauses-web.XXXXXX).tar.gz"
    docker save eclauses-web:dev | gzip > "$archive"
    total=$(stat -f%z "$archive")
    remote "rm -f $DIR/image.tar.gz"
    for essai in 1 2 3 4 5 6; do
      recu=$(remote "stat -c%s $DIR/image.tar.gz 2>/dev/null || echo 0")
      [ "$recu" -ge "$total" ] && break
      tail -c +$((recu + 1)) "$archive" | remote "cat >> $DIR/image.tar.gz" || { echo "transfert interrompu (essai $essai), reprise…"; sleep 5; }
    done
    [ "$(remote "stat -c%s $DIR/image.tar.gz")" -eq "$total" ] || { echo "transfert incomplet"; exit 1; }
    rm -f "$archive"
    remote "cd $DIR && gunzip < image.tar.gz | docker load && rm -f image.tar.gz"
    scp -q -o IdentitiesOnly=yes -i "$KEY" infra/dev-sandbox/docker-compose.yml "$HOST:$DIR/docker-compose.yml"
    remote "cd $DIR && docker compose up -d && docker compose ps" ;;
  status) remote "cd $DIR && docker compose ps && curl -s -m5 http://\$(grep ^WEB_BIND .env | cut -d= -f2):3200/api/health; echo" ;;
  logs) remote "cd $DIR && docker compose logs --tail=100 web" ;;
  tunnel) echo "Tunnel vers la base distante sur localhost:5436 (Ctrl+C pour fermer)"; exec ssh -o IdentitiesOnly=yes -i "$KEY" -N -L 5436:127.0.0.1:5435 "$HOST" ;;
  *) echo "commande inconnue"; exit 1 ;;
esac
