#!/bin/sh
set -eu

SECRET_FILE="${WHATSAPP_INTERNAL_TOKEN_FILE:-/run/secrets/whatsapp_token}"

if [ -z "${WHATSAPP_INTERNAL_TOKEN:-}" ] && [ -f "$SECRET_FILE" ]; then
  export WHATSAPP_INTERNAL_TOKEN="$(tr -d '\r\n' < "$SECRET_FILE")"
fi

exec "$@"
