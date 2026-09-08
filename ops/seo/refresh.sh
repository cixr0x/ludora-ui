#!/bin/sh
set -eu
export LUDORA_UI_ROOT="${LUDORA_UI_ROOT:-/opt/ludora/ludora-ui}"
export LUDORA_SEO_STATE_DIR="${LUDORA_SEO_STATE_DIR:-/var/lib/ludoradar-seo}"
export LUDORA_SEO_LIVE_PATH="${LUDORA_SEO_LIVE_PATH:-/opt/ludora/ludora-ui/dist}"
export LUDORA_SEO_LOCK_PATH="${LUDORA_SEO_LOCK_PATH:-/run/lock/ludoradar-seo-refresh.lock}"
export LUDORA_PRERENDER_API_ORIGIN="${LUDORA_PRERENDER_API_ORIGIN:-http://127.0.0.1:4000}"
exec /usr/bin/node --max-old-space-size=256 "$LUDORA_UI_ROOT/scripts/refresh-seo.mjs"
