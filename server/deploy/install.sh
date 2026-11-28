#!/usr/bin/env bash
# BlockBattle — Copyright (C) 2026 Arvin Zaman
# Original source: https://github.com/Arvin2A/BlockBattle
# Licensed under the GNU GPL v3 only. See LICENSE.

set -euo pipefail

SERVICE=blockbattle
UPDATE_SERVICE=blockbattle-update
UNIT_DIR=/etc/systemd/system
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$DEPLOY_DIR/../.." && pwd)"
CONFIG="$DEPLOY_DIR/server.conf"
MIN_NODE=18

RUN_USER=""
ASSUME_YES=false
DRY_RUN=false
UNINSTALL=false
AUTOUPDATE=false
SKIP_BUILD=false

usage() {
    cat <<EOF
Usage: sudo $0 [options]

Installs the BlockBattle online server as a systemd service ($SERVICE),
using the settings in $CONFIG.

Options:
  --user NAME         Run the server as NAME instead of you (the user who ran sudo)
  --with-autoupdate   Also install the update timer (pulls from GitHub every 5 minutes)
  --skip-build        Don't run npm ci / npm run build (use the existing dist/)
  --yes               Don't ask for confirmation
  --dry-run           Check everything and show what would happen, change nothing
  --uninstall         Stop and remove the service (keeps the repo and server.conf)
  -h, --help          Show this help
EOF
}

while [ $# -gt 0 ]; do
    case "$1" in
        --user) RUN_USER="${2:-}"; shift 2 ;;
        --with-autoupdate) AUTOUPDATE=true; shift ;;
        --skip-build) SKIP_BUILD=true; shift ;;
        --yes|-y) ASSUME_YES=true; shift ;;
        --dry-run) DRY_RUN=true; shift ;;
        --uninstall) UNINSTALL=true; shift ;;
        -h|--help) usage; exit 0 ;;
        *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
    esac
done

default_config() {
    cat <<'CONF'
# Settings for the BlockBattle online server, read by install.sh and the systemd service.
# install.sh wrote this file. Fill in the required settings, then run it again:
#   sudo server/deploy/install.sh
# After changing it later: sudo systemctl restart blockbattle
#
# One NAME=value per line. No quotes, no spaces around =, no comments at the end of a line.
# A line starting with # is ignored. server.conf is never committed (it's in .gitignore),
# so secrets like the TURN token and Discord webhooks are safe to put here.

# REQUIRED. Websites allowed to use your server: https:// + domain only, no path, no
# trailing slash, comma-separated. Add app://blockbattle to let the desktop app in.
# Example: BB_ALLOWED_ORIGINS=https://yourname.github.io,app://blockbattle
BB_ALLOWED_ORIGINS=

# Matches that can run at the same time. About 400 MB of RAM each (see SERVER_SETUP.md step 0).
BB_MAX_MATCHES=4

# Connections allowed from one IP address (flood guard).
BB_MAX_PER_IP=32

# Where the server listens. 127.0.0.1 = only this machine, reached through a tunnel or
# Caddy (SERVER_SETUP.md step 5). Use 0.0.0.0 only if players connect to this machine
# directly, and remember HTTPS websites can only reach a secure wss:// address.
HOST=127.0.0.1
PORT=8080

# Plain WebSocket only by default. The WebRTC fast path needs a Cloudflare TURN key; to
# turn it on, set BB_FAST_PATH=true and fill in both TURN lines below.
BB_FAST_PATH=false
BB_TURN_KEY_ID=
BB_TURN_API_TOKEN=

# Path to Chrome / Chromium / Edge. Leave empty to find it automatically.
CHROME_PATH=

# Optional Discord pings (SERVER_SETUP.md "Discord pings"). Leave empty to turn them off.
BB_DISCORD_QUEUE_WEBHOOK=
BB_DISCORD_LOBBY_WEBHOOK=
BB_DISCORD_QUEUE_ROLE=
BB_DISCORD_LOBBY_ROLE=
BB_DISCORD_GAME_LINK=

# Optional tournament host codes, comma-separated. Leave empty to turn tournament rooms off.
BB_TOURNAMENT_CODE=
CONF
}

PROBLEMS=()
problem() { PROBLEMS+=("$1"); }
say() { printf '%s\n' "$*"; }
step() { printf '\n==> %s\n' "$*"; }
run() {
    if $DRY_RUN; then
        printf '[dry run] %s\n' "$*"
    else
        "$@"
    fi
}
as_user() { runuser -u "$RUN_USER" -- bash -lc "$1"; }
confirm() {
    $ASSUME_YES && return 0
    local answer
    read -r -p "$1 [y/N] " answer
    [[ "$answer" =~ ^[Yy]$ ]]
}

if [ "$(id -u)" -ne 0 ]; then
    echo "This needs superuser permissions. Run it with sudo:" >&2
    echo "  sudo $0 $*" >&2
    exit 1
fi

if ! command -v systemctl >/dev/null 2>&1 || [ ! -d /run/systemd/system ]; then
    echo "This machine doesn't use systemd, so the service can't be installed." >&2
    echo "Run the server by hand instead: npm run server (see SERVER_SETUP.md)." >&2
    exit 1
fi

if $UNINSTALL; then
    step "Removing the BlockBattle service"
    confirm "Stop and remove $SERVICE (and the update timer, if installed)?" || { say "Cancelled."; exit 0; }
    for unit in "$UPDATE_SERVICE.timer" "$UPDATE_SERVICE.service" "$SERVICE.service"; do
        if [ -f "$UNIT_DIR/$unit" ]; then
            run systemctl disable --now "$unit" || true
            run rm -f "$UNIT_DIR/$unit"
            say "Removed $unit"
        fi
    done
    run systemctl daemon-reload
    say "Done. The repo and $CONFIG were left alone."
    exit 0
fi

if [ -z "$RUN_USER" ]; then
    RUN_USER="${SUDO_USER:-}"
fi
if [ -z "$RUN_USER" ] || [ "$RUN_USER" = root ]; then
    echo "Couldn't tell which user should run the server (you seem to be logged in as root)." >&2
    echo "The server shouldn't run as root. Pick a user with: sudo $0 --user NAME" >&2
    exit 1
fi

step "Checking everything first (nothing is installed until all checks pass)"

if ! id "$RUN_USER" >/dev/null 2>&1; then
    problem "User '$RUN_USER' doesn't exist. Create it first (SERVER_SETUP.md step 1)."
else
    owner="$(stat -c %U "$APP_DIR")"
    if [ "$owner" != "$RUN_USER" ]; then
        problem "$APP_DIR belongs to '$owner', not '$RUN_USER'. Clone the repo as '$RUN_USER', or: sudo chown -R $RUN_USER: $APP_DIR"
    fi
fi

declare -A CONF=()
if [ ! -f "$CONFIG" ] && $DRY_RUN; then
    problem "There's no $CONFIG yet. A real run creates it with blank settings for you to fill in."
elif [ ! -f "$CONFIG" ] && ! id "$RUN_USER" >/dev/null 2>&1; then
    problem "There's no $CONFIG yet. It gets created once the user problem above is fixed."
else
    if [ ! -f "$CONFIG" ]; then
        default_config > "$CONFIG"
        chown "$RUN_USER:" "$CONFIG"
        chmod 600 "$CONFIG"
        say "Created $CONFIG with blank and default settings."
    fi
    line_no=0
    while IFS= read -r line || [ -n "$line" ]; do
        line_no=$((line_no + 1))
        line="${line%$'\r'}"
        [[ -z "${line//[[:space:]]/}" || "$line" =~ ^[[:space:]]*# ]] && continue
        if [[ ! "$line" =~ ^([A-Z_][A-Z0-9_]*)=(.*)$ ]]; then
            problem "server.conf line $line_no isn't NAME=value: $line"
            continue
        fi
        key="${BASH_REMATCH[1]}"
        value="${BASH_REMATCH[2]}"
        if [[ "$value" =~ ^[\"\'] ]]; then
            problem "server.conf line $line_no: don't put quotes around values ($key)"
        fi
        if [[ "$value" =~ [[:space:]]# ]]; then
            problem "server.conf line $line_no: comments at the end of a line aren't allowed ($key)"
        fi
        CONF[$key]="$value"
    done < "$CONFIG"

    declare -A KNOWN=()
    missing_lines=()
    missing_keys=()
    while IFS= read -r line; do
        [[ "$line" =~ ^([A-Z_][A-Z0-9_]*)= ]] || continue
        KNOWN[${BASH_REMATCH[1]}]=1
        if [ -z "${CONF[${BASH_REMATCH[1]}]+set}" ]; then
            missing_keys+=("${BASH_REMATCH[1]}")
            missing_lines+=("$line")
        fi
    done < <(default_config)
    for extra in BB_TURN_RELAY_ONLY BB_GAME_URL BB_AUTHORITY; do KNOWN[$extra]=1; done

    if [ ${#missing_keys[@]} -gt 0 ]; then
        if $DRY_RUN; then
            problem "server.conf is missing these settings: ${missing_keys[*]}. A real run adds them with their defaults."
        else
            {
                printf '\n# Added by install.sh on %s: settings this file was missing, at their defaults.\n' "$(date +%F)"
                printf '%s\n' "${missing_lines[@]}"
            } >> "$CONFIG"
            for entry in "${missing_lines[@]}"; do CONF[${entry%%=*}]="${entry#*=}"; done
            problem "server.conf was missing these settings: ${missing_keys[*]}. They were added at the end of $CONFIG with their defaults. Check them, then run this again."
        fi
    fi
    for key in "${!CONF[@]}"; do
        if [ -z "${KNOWN[$key]+set}" ]; then
            say "Note: server.conf has a setting the server doesn't know, '$key'. Check it for typos (it's ignored)."
        fi
    done

    origins="${CONF[BB_ALLOWED_ORIGINS]:-}"
    if [ -z "$origins" ]; then
        problem "Fill in BB_ALLOWED_ORIGINS in $CONFIG: the website(s) hosting your copy of the game."
    else
        IFS=',' read -r -a origin_list <<< "$origins"
        for origin in "${origin_list[@]}"; do
            origin="${origin// /}"
            if [ -z "$origin" ]; then
                continue
            elif [ "$origin" = "app://blockbattle" ]; then
                continue
            elif [[ ! "$origin" =~ ^https?://[^/[:space:]]+$ ]]; then
                problem "BB_ALLOWED_ORIGINS entry '$origin' should be https:// + domain only, with no path and no trailing slash."
            fi
        done
    fi

    port="${CONF[PORT]:-8080}"
    if [[ ! "$port" =~ ^[0-9]+$ ]] || [ "$port" -lt 1 ] || [ "$port" -gt 65535 ]; then
        problem "PORT must be a number from 1 to 65535 (it's '$port')."
    fi
    for number_key in BB_MAX_MATCHES BB_MAX_PER_IP; do
        value="${CONF[$number_key]:-}"
        if [ -n "$value" ] && [[ ! "$value" =~ ^[1-9][0-9]*$ ]]; then
            problem "$number_key must be a whole number above 0 (it's '$value')."
        fi
    done
    fast="${CONF[BB_FAST_PATH]:-false}"
    if [ "$fast" = true ] && { [ -z "${CONF[BB_TURN_KEY_ID]:-}" ] || [ -z "${CONF[BB_TURN_API_TOKEN]:-}" ]; }; then
        problem "BB_FAST_PATH=true needs both BB_TURN_KEY_ID and BB_TURN_API_TOKEN. Fill them in or set BB_FAST_PATH=false."
    fi
fi

NODE_PATH=""
if id "$RUN_USER" >/dev/null 2>&1; then
    NODE_PATH="$(as_user 'command -v node' 2>/dev/null || true)"
    if [ -z "$NODE_PATH" ]; then
        problem "Node.js isn't installed for '$RUN_USER' (SERVER_SETUP.md step 2)."
    else
        node_major="$(as_user "'$NODE_PATH' -p 'process.versions.node.split(\".\")[0]'" 2>/dev/null || echo 0)"
        if [ "${node_major:-0}" -lt "$MIN_NODE" ]; then
            problem "Node.js $MIN_NODE or newer is needed (found $(as_user "'$NODE_PATH' -v" 2>/dev/null || echo unknown))."
        fi
    fi
    if ! as_user 'command -v npm' >/dev/null 2>&1; then
        problem "npm isn't installed for '$RUN_USER' (it comes with Node.js, SERVER_SETUP.md step 2)."
    fi
fi

if [ -n "$NODE_PATH" ] && [ ${#PROBLEMS[@]} -eq 0 ]; then
    chrome="$(cd "$APP_DIR" && runuser -u "$RUN_USER" -- env "CHROME_PATH=${CONF[CHROME_PATH]:-}" PATH="$(dirname "$NODE_PATH"):/usr/local/bin:/usr/bin:/bin" \
        "$NODE_PATH" --input-type=module -e "import('./server/chrome.js').then(m => console.log(m.findChrome() ?? ''))" 2>/dev/null || true)"
    if [ -z "$chrome" ]; then
        problem "No Chrome, Chromium or Edge found. Install one (SERVER_SETUP.md step 2), or set CHROME_PATH in server.conf."
    elif [ ! -x "$chrome" ] && ! command -v "$chrome" >/dev/null 2>&1; then
        problem "CHROME_PATH points at '$chrome', which isn't a program that can run."
    fi
fi

if [ -n "${port:-}" ] && [[ "$port" =~ ^[0-9]+$ ]] && ! systemctl is-active --quiet "$SERVICE"; then
    if command -v ss >/dev/null 2>&1 && ss -ltnH "sport = :$port" | grep -q .; then
        problem "Something is already using port $port. Stop it or pick another PORT in server.conf."
    fi
fi

if $SKIP_BUILD && [ ! -f "$APP_DIR/dist/index.html" ]; then
    problem "--skip-build was given, but there's no build in $APP_DIR/dist yet."
fi

if [ ${#PROBLEMS[@]} -gt 0 ]; then
    echo >&2
    echo "Not installing. Fix these first:" >&2
    for item in "${PROBLEMS[@]}"; do echo "  - $item" >&2; done
    exit 1
fi
say "All checks passed."

step "About to set up the BlockBattle server"
say "  Runs as user:   $RUN_USER"
say "  Game folder:    $APP_DIR"
say "  Settings file:  $CONFIG"
say "  Node.js:        $NODE_PATH"
say "  Listens on:     ${CONF[HOST]:-127.0.0.1}:$port"
say "  Network:        $([ "${CONF[BB_FAST_PATH]:-false}" = true ] && echo 'WebSocket + WebRTC fast path' || echo 'WebSocket only')"
say "  Auto-update:    $($AUTOUPDATE && echo 'yes, every 5 minutes' || echo 'no')"
if [ -f "$UNIT_DIR/$SERVICE.service" ]; then
    say "  Replaces:       the existing $UNIT_DIR/$SERVICE.service (it gets restarted)"
fi
echo
say "WARNING: the service runs as '$RUN_USER' and starts on every boot. It can read and"
say "change anything '$RUN_USER' can, including the rest of that user's home folder."
say "A separate user just for the server is safer (SERVER_SETUP.md step 1, then --user)."
echo
confirm "Continue?" || { say "Cancelled. Nothing was changed."; exit 0; }

if ! $SKIP_BUILD; then
    step "Installing packages and building the game (as $RUN_USER)"
    if $DRY_RUN; then
        say "[dry run] cd $APP_DIR && npm ci && npm run build"
    else
        as_user "cd '$APP_DIR' && npm ci --no-audit --no-fund && npm run build"
    fi
fi

step "Protecting the settings file"
run chown "$RUN_USER:" "$CONFIG"
run chmod 600 "$CONFIG"

step "Writing $UNIT_DIR/$SERVICE.service"
unit="[Unit]
Description=BlockBattle online server
After=network-online.target
Wants=network-online.target

[Service]
User=$RUN_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$CONFIG
ExecStart=$NODE_PATH server/index.js
Restart=always
RestartSec=5
NoNewPrivileges=true
ProtectSystem=full
PrivateTmp=true

[Install]
WantedBy=multi-user.target"
if $DRY_RUN; then
    printf '%s\n' "$unit"
else
    printf '%s\n' "$unit" > "$UNIT_DIR/$SERVICE.service"
fi

if $AUTOUPDATE; then
    step "Writing the update timer"
    update_unit="[Unit]
Description=BlockBattle auto-update check
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/bin/bash $DEPLOY_DIR/autoupdate.sh
Environment=BRANCH=main
Environment=APP_USER=$RUN_USER
Environment=STATUS_URL=http://127.0.0.1:$port/mp/status"
    if $DRY_RUN; then
        printf '%s\n' "$update_unit"
    else
        printf '%s\n' "$update_unit" > "$UNIT_DIR/$UPDATE_SERVICE.service"
        cp "$DEPLOY_DIR/$UPDATE_SERVICE.timer" "$UNIT_DIR/$UPDATE_SERVICE.timer"
    fi
fi

step "Starting the service"
run systemctl daemon-reload
run systemctl enable "$SERVICE"
run systemctl restart "$SERVICE"
if $AUTOUPDATE; then
    run systemctl enable --now "$UPDATE_SERVICE.timer"
fi

if $DRY_RUN; then
    step "Dry run finished. Nothing was changed."
    exit 0
fi

sleep 3
if systemctl is-active --quiet "$SERVICE"; then
    step "BlockBattle server is running"
else
    step "The service didn't stay running. Last log lines:"
    journalctl -u "$SERVICE" -n 20 --no-pager || true
    exit 1
fi
say "  Status:      systemctl status $SERVICE --no-pager"
say "  Live logs:   sudo journalctl -u $SERVICE -f"
say "  Check it:    curl http://127.0.0.1:$port/mp/status"
say "  Settings:    edit $CONFIG, then: sudo systemctl restart $SERVICE"
say "  Remove it:   sudo $0 --uninstall"
echo
say "Players still can't reach it from the internet yet. Do SERVER_SETUP.md step 5"
say "(Cloudflare Tunnel or Caddy) and step 6 (list it in mp/servers.js) next."
