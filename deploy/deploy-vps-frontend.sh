#!/usr/bin/env bash
# Deploy a built frontend (default: dist-vps/) to minikki.in on the CloudPanel VPS.
#
#   npx vite build --mode vps --outDir dist-vps --emptyOutDir
#   bash deploy/deploy-vps-frontend.sh            # deploy
#   bash deploy/deploy-vps-frontend.sh --rollback # restore the previous site
#
# Backs up the live docroot first. Old hashed assets are kept so visitors with
# the page already open don't get 404s on lazy-loaded chunks. index.html is
# swapped last, atomically.
set -euo pipefail
HOST=${HOST:-minikki}
SRC=${SRC:-dist-vps}

if [ "${1:-}" = "--rollback" ]; then
  ssh "$HOST" 'set -e
    R=/home/minikki/htdocs/minikki.in; B=$(cat /root/minikki-backend/frontend-rollback-path)
    [ -d "$B" ] || { echo "no backup at $B"; exit 1; }
    cp -a "$B"/. "$R"/ && chown -R minikki:minikki "$R" && echo "restored from $B"'
  exit 0
fi

[ -f "$SRC/index.html" ] || { echo "build $SRC first"; exit 1; }
if grep -rqE "supabase\.co" "$SRC"/assets/*.js; then
  echo "refusing: $SRC still references supabase.co"; exit 1
fi

tar -C "$SRC" -cf - . | ssh "$HOST" 'set -e
  R=/home/minikki/htdocs/minikki.in; TS=$(date +%Y%m%d-%H%M%S)
  B=/home/minikki/backups/minikki.in-$TS
  mkdir -p /home/minikki/backups; cp -a "$R" "$B"; echo "backup: $B"
  ST=$(mktemp -d); tar -xf - -C "$ST"
  cp -a "$ST"/assets/. "$R"/assets/
  find "$ST" -mindepth 1 -maxdepth 1 ! -name assets ! -name index.html -exec cp -a {} "$R"/ \;
  cp -a "$ST"/index.html "$R"/index.html.new && mv "$R"/index.html.new "$R"/index.html
  chown -R minikki:minikki "$R"; rm -rf "$ST"
  echo "$B" > /root/minikki-backend/frontend-rollback-path
  echo "live entry: $(grep -oE "assets/index-[A-Za-z0-9_-]+\.js" "$R"/index.html)"'
echo "deployed. verify: https://www.minikki.in"
