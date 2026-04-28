#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"

cd "$ROOT_DIR"

if [ ! -f "./secrets/whatsapp_token.txt" ]; then
  echo "Missing ./secrets/whatsapp_token.txt" >&2
  exit 1
fi

if ! docker network inspect salgados_backend_net >/dev/null 2>&1; then
  docker network create salgados_backend_net >/dev/null
fi

echo "Salgados WhatsApp deploy"
echo "1) Reiniciar e limpar a sessão WhatsApp"
echo "2) Reiniciar sem limpar a sessão"
echo "3) Sair"
printf "Selecione uma opção [1-3]: "

choice=""
read choice || true

case "$choice" in
  1|"")
    docker compose down -v --remove-orphans
    docker compose up -d --build
    ;;
  2)
    docker compose down --remove-orphans
    docker compose up -d --build
    ;;
  3)
    echo "Cancelado."
    exit 0
    ;;
  *)
    echo "Opção inválida."
    exit 1
    ;;
esac
