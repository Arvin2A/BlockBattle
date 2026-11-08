#!/usr/bin/env bash
# BlockBattle — Copyright (C) 2026 Arvin Zaman
# Original source: https://github.com/Arvin2A/BlockBattle
# Licensed under the GNU GPL v3 only. See LICENSE.

# Pulls new commits from GitHub and only does what they need.
# Run by blockbattle-update.timer every few minutes (see SERVER_SETUP.md).
# - Nothing new on GitHub: does nothing.
# - Only game (client) files changed: rebuilds the site in place, no restart,
#   so matches and queues keep going. New matches use the new build.
# - Files the server itself runs changed (server/, mp/, the roster, ...): waits
#   until there are no matches and nobody is queued, then restarts.
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
APP_USER="${APP_USER:-$(stat -c %U "$APP_DIR")}"
BRANCH="${BRANCH:-main}"
SERVICE="${SERVICE:-blockbattle}"
STATUS_URL="${STATUS_URL:-http://127.0.0.1:8080/mp/status}"

as_app() { runuser -u "$APP_USER" -- "$@"; }

status_number() {
    echo "$1" | grep -o "\"$2\":[0-9]*" | cut -d: -f2
}

server_busy() {
    systemctl is-active --quiet "$SERVICE" || return 1
    local status
    if ! status=$(curl -fsS --max-time 5 "$STATUS_URL"); then
        echo "Server is running but $STATUS_URL didn't answer; not restarting it blind."
        return 0
    fi
    local matches queued
    matches=$(status_number "$status" matches)
    queued=$(status_number "$status" queued)
    if [ "${matches:-0}" -gt 0 ] || [ "${queued:-0}" -gt 0 ]; then
        echo "Waiting: ${matches:-0} match(es) running, ${queued:-0} player(s) queued."
        return 0
    fi
    return 1
}

rebuild_site() {
    as_app rm -rf dist-next dist-old
    as_app env BUILD_DIR=dist-next npm run build
    if [ -d dist ]; then as_app mv dist dist-old; fi
    as_app mv dist-next dist
    as_app rm -rf dist-old
}

cd "$APP_DIR"
as_app git fetch --quiet origin "$BRANCH"
if as_app git merge-base --is-ancestor "origin/$BRANCH" HEAD; then
    exit 0
fi

current=$(as_app git rev-parse HEAD)
latest=$(as_app git rev-parse "origin/$BRANCH")
changed=$(as_app git diff --name-only HEAD "origin/$BRANCH")
server_files=$(as_app node server/deploy/serverFiles.mjs)

needs_restart=false
if grep -qxF -f <(echo "$server_files") <(echo "$changed"); then
    needs_restart=true
fi

if $needs_restart && server_busy; then
    echo "Update to ${latest:0:7} changes the server; it will apply once things are quiet."
    exit 0
fi

echo "Updating ${current:0:7} -> ${latest:0:7}"
as_app git merge --ff-only --quiet "origin/$BRANCH"
if echo "$changed" | grep -qxE 'package(-lock)?\.json'; then
    as_app npm ci --no-audit --no-fund
fi
rebuild_site

if $needs_restart; then
    systemctl restart "$SERVICE"
    echo "Server files changed: restarted $SERVICE."
else
    echo "Only game files changed: rebuilt the site, server kept running."
fi
