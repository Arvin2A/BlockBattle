#!/usr/bin/env bash
# BlockBattle — Copyright (C) 2026 Arvin Zaman
# Original source: https://github.com/Arvin2A/BlockBattle
# Licensed under the GNU GPL v3 only. See LICENSE.

# Pulls new commits from GitHub, rebuilds and restarts the server.
# Run by blockbattle-update.timer every few minutes (see SERVER_SETUP.md).
# If a match is in progress it waits for the next run, so nobody gets kicked.
set -euo pipefail

# Defaults: the repo this script is in, and the user who owns it.
APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
APP_USER="${APP_USER:-$(stat -c %U "$APP_DIR")}"
BRANCH="${BRANCH:-main}"
SERVICE="${SERVICE:-blockbattle}"
STATUS_URL="${STATUS_URL:-http://127.0.0.1:8080/mp/status}"

as_app() { runuser -u "$APP_USER" -- "$@"; }

cd "$APP_DIR"
as_app git fetch --quiet origin "$BRANCH"
current=$(as_app git rev-parse HEAD)
latest=$(as_app git rev-parse "origin/$BRANCH")
[ "$current" = "$latest" ] && exit 0

# A server that's down counts as 0 matches, so it still gets updated.
matches=$(curl -fsS --max-time 5 "$STATUS_URL" | grep -o '"matches":[0-9]*' | cut -d: -f2 || echo 0)
if [ "${matches:-0}" -gt 0 ]; then
    echo "Update to ${latest:0:7} waiting: $matches match(es) in progress."
    exit 0
fi

echo "Updating ${current:0:7} -> ${latest:0:7}"
as_app git merge --ff-only --quiet "origin/$BRANCH"
as_app npm ci --no-audit --no-fund
as_app npm run build
systemctl restart "$SERVICE"
echo "Updated and restarted $SERVICE."
