# Hosting a BlockBattle online server

This guide turns a Linux machine into a BlockBattle online server: the matchmaking queue,
plus a hidden Chrome tab that runs each match. It works for:

- **Your own copy of the game** (a fork) hosted on GitHub Pages or any other static site, or
- **Just the server**: players open the game straight from it, with no website needed.

Any always-on Linux machine works: a spare PC, a home server, or a cloud VPS. The commands
are written for Debian/Ubuntu (`apt`); other distros work the same with their own package
manager. Everything can be done over SSH, and no screen or desktop is needed.

```
static website (GitHub Pages, etc.) ── serves the game files
          player's browser          ── wss://your-server-address/mp ──►  your server
                                                                          (queue + one hidden Chrome tab per match)
```

Just want to play with people on the same Wi-Fi? You don't need any of this. Run
`npm install` and `npm run lan` (see the README).

## 0. Check the machine

```bash
uname -m                 # x86_64 = Google Chrome works. aarch64/arm = use Chromium (step 2)
nproc && free -h         # CPU cores and RAM
cat /etc/os-release      # which distro
```

Each running match uses about **400 MB of RAM** and part of a CPU core. Rough guide:

| Machine | Matches at once (`BB_MAX_MATCHES`) |
|---|---|
| 2 GB RAM / 1–2 cores | 2 |
| 4 GB RAM / 2–4 cores | 4–6 |
| 8 GB+ RAM / 4+ cores | 6–10 (watch `htop` during matches and adjust) |

On older machines the CPU usually runs out before the RAM does.

## 1. Pick which user runs the server

**Recommended:** a separate user, so the game server can't touch your other files:

```bash
sudo adduser --disabled-password --gecos "" blockbattle
```

The rest of this guide assumes the user is `blockbattle`, with the game in
`/home/blockbattle/BlockBattle`. If you'd rather use your own login, that works too. Just
replace `blockbattle` with your username in the commands and in the service file (step 4).

## 2. Install Node.js and Chrome

```bash
# Node.js 20 (18 or newer works)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git

# Google Chrome (runs headless, no desktop needed)
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo apt install -y ./google-chrome-stable_current_amd64.deb
rm google-chrome-stable_current_amd64.deb

# ARM machine (e.g. Raspberry Pi)? Use Chromium instead:
#   sudo apt install -y chromium
```

The server finds Chrome, Chromium or Edge by itself. If yours is somewhere unusual, set
`CHROME_PATH` (see the settings table in step 4).

## 3. Get the game and test it

```bash
sudo -iu blockbattle                       # become the server user (skip if using your own)
git clone https://github.com/<OWNER>/BlockBattle.git    # this repo, or your fork
cd BlockBattle
npm ci
npm run build
HOST=127.0.0.1 npm run server              # should print "BlockBattle LAN server is running!"
```

In a second SSH window, `curl http://127.0.0.1:8080/mp/status` should print
`{"online":0,"queued":0,"matches":0}`. Stop the test with Ctrl+C, then `exit` back to your
own user.

## 4. Run it 24/7 with systemd

systemd starts the server on boot and restarts it if it crashes.

```bash
sudo cp /home/blockbattle/BlockBattle/server/deploy/blockbattle.service /etc/systemd/system/
sudo nano /etc/systemd/system/blockbattle.service
```

Check these lines in the file (systemd doesn't allow comments at the end of a line, so keep
each setting alone on its line):

```ini
# the user from step 1 (it must exist)
User=blockbattle
# the folder you cloned the game into
WorkingDirectory=/home/blockbattle/BlockBattle
# run `which node` if unsure of this path
ExecStart=/usr/bin/node server/index.js
# your website(s), see "Server settings" below
Environment=BB_ALLOWED_ORIGINS=https://<your-username>.github.io
```

Then start it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now blockbattle
systemctl status blockbattle --no-pager             # want: "active (running)"
sudo journalctl -u blockbattle -f                   # live logs, Ctrl+C to stop watching
```

### Server settings

Set these as `Environment=NAME=value` lines in the service file, then run
`sudo systemctl daemon-reload && sudo systemctl restart blockbattle`. Don't put quotes
around values.

| Setting | Default | What it does |
|---|---|---|
| `BB_ALLOWED_ORIGINS` | *(anyone)* | Comma-separated websites allowed to use your server (see below) |
| `BB_MAX_MATCHES` | `4` | Matches that can run at the same time |
| `BB_MAX_PER_IP` | `8` | Connections allowed from one IP address |
| `HOST` | `0.0.0.0` | `127.0.0.1` when using a tunnel/Caddy (step 5), so only they can reach it |
| `PORT` | `8080` | Port the server listens on |
| `CHROME_PATH` | *(auto)* | Path to Chrome/Chromium/Edge if it isn't found automatically |

**`BB_ALLOWED_ORIGINS`** lists the websites that host your copy of the game. Write each one
as `https://` + domain only, with **no path and no trailing slash**: browsers only report
the domain, so `https://<your-username>.github.io` covers
`https://<your-username>.github.io/BlockBattle/`. `http://` and `https://` count as
different, so list both if your site uses both. Pages served by the server itself are always
allowed. Leave the setting out to allow any website (fine for testing, not for a public
server).

## 5. Make it reachable from the internet (with HTTPS)

Websites on `https://` (GitHub Pages, most hosts) may only connect to a **secure `wss://`**
address, so the server needs a domain name with an HTTPS certificate. Pick one option.

### Option A (recommended): Cloudflare Tunnel
No router port forwarding, your IP address stays hidden, HTTPS is automatic, and Cloudflare
absorbs attacks. You need a domain added to a free Cloudflare account (domains cost around
$10/year; students can often get one free through the GitHub Student Developer Pack).

```bash
# install cloudflared (other distros: see developers.cloudflare.com)
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo apt install -y ./cloudflared.deb && rm cloudflared.deb

cloudflared tunnel login        # prints a link: open it in a browser on ANY device and approve
cloudflared tunnel create blockbattle
cloudflared tunnel route dns blockbattle play.<your-domain>
```

`tunnel login` works over SSH: copy the link it prints into a browser on your own computer or
phone, approve it, and the server picks up the permission by itself.

Create `~/.cloudflared/config.yml` (the tunnel ID was printed by `tunnel create`):

```yaml
tunnel: <TUNNEL-ID>
credentials-file: /home/<your-user>/.cloudflared/<TUNNEL-ID>.json
ingress:
  - hostname: play.<your-domain>
    service: http://127.0.0.1:8080
  - service: http_status:404
```

```bash
sudo cloudflared service install       # runs the tunnel 24/7 as well
```

Your server address: **`wss://play.<your-domain>/mp`**

### Option B (free): DuckDNS + port forwarding + Caddy
Free, but your IP address becomes public and you need access to your router's settings.
Some internet providers block ports 80/443 on home connections, and then this won't work.

1. Create a free subdomain at duckdns.org (e.g. `mygame.duckdns.org`) and follow their
   "install" page so it stays pointed at your IP.
2. On your router, forward TCP ports **80 and 443** to this machine's local IP address.
3. Install Caddy (`sudo apt install -y caddy`) and replace `/etc/caddy/Caddyfile` with:
   ```
   mygame.duckdns.org {
       reverse_proxy 127.0.0.1:8080
   }
   ```
   then `sudo systemctl reload caddy`. Caddy gets the HTTPS certificate by itself.

Your server address: **`wss://mygame.duckdns.org/mp`**

### Option C (testing only): Cloudflare Quick Tunnel
No account and no domain. Good for checking that everything works from outside your network:

```bash
cloudflared tunnel --url http://127.0.0.1:8080
```

It prints an address like `https://random-words.trycloudflare.com`, so your server address
is `wss://random-words.trycloudflare.com/mp`. The address **changes every time it restarts**
and it stops when you close the SSH window, so don't put it on a public website long-term.

With options A and B, set `HOST=127.0.0.1` in the service file so the server is only
reachable through the tunnel or Caddy.

## 6. Connect your website to the server

Skip this if players will only open the game from the server itself
(`https://<your-server-address>/BlockBattle/`), which works without a website.

If your copy of the game is deployed by this repo's GitHub Actions workflow
(`.github/workflows/deploy.yml`), go to **your repo > Settings > Secrets and variables >
Actions > Variables > New repository variable** and add:

| Name | Value (type it plain, **no quotes**) |
|---|---|
| `MP_SERVER_URL` | your server address from step 5, e.g. `wss://play.<your-domain>/mp`. Must start with `wss://` and end with `/mp` |
| `MP_SERVER_NAME` | *(optional)* name players see, e.g. `US EAST` or the city it's in |

Then re-run the workflow (Actions tab > the deploy workflow > Run workflow). The values are
built into the site, so changing them always needs a redeploy.

Building some other way? Set the same values as environment variables while building:
`VITE_MP_SERVER=wss://... VITE_MP_SERVER_NAME="US EAST" npm run build`.

The ONLINE button on the main menu then shows:

| Button text | Meaning |
|---|---|
| `US EAST - 3 ONLINE` | Server is up, click to play |
| `SERVER OFFLINE` (greyed) | Server/tunnel is down, or your site isn't in `BB_ALLOWED_ORIGINS` |
| `NOT AVAILABLE` (greyed) | This build has no server address (`MP_SERVER_URL` not set) |

**Forks:** the included workflow also uploads to InfinityFree using the `FTP_SERVER`,
`FTP_USERNAME` and `FTP_PASSWORD` secrets. If you don't use InfinityFree, delete the
InfinityFree steps from the workflow, or that part of the run will fail.

## Updating

Keep the server on the same version as your website. When the online code changes, an
outdated page shows a "refresh the page" message instead of working.

```bash
sudo -iu blockbattle bash -c 'cd BlockBattle && git pull && npm ci && npm run build'
sudo systemctl restart blockbattle
```

Restarting ends any matches in progress, so do it when nobody is playing.

## Troubleshooting

| Problem | What to check |
|---|---|
| `systemctl status` shows `status=217/USER` | The `User=` in the service file doesn't exist. Fix it (step 1/4), then `daemon-reload` and `restart` |
| `status=203/EXEC` | Wrong `ExecStart` path to node. Use the output of `which node` |
| `status=200/CHDIR` | Wrong `WorkingDirectory`. It must be the folder you cloned |
| "bad unit file setting" | The service file is broken or empty. Copy it again from `server/deploy/` |
| `Port 8080 is already in use` | Another copy is still running (e.g. a test in another SSH window). Stop it |
| `journalctl` shows nothing | Use `sudo journalctl -u blockbattle ...` |
| Button says NOT AVAILABLE | `MP_SERVER_URL` isn't set, or the site wasn't redeployed after setting it |
| Button says SERVER OFFLINE | Server or tunnel isn't running, or the site's address isn't in `BB_ALLOWED_ORIGINS` |
| "Match crashed on the server" | `sudo journalctl -u blockbattle -n 100`. Is Chrome installed? Out of memory? |
| Laggy for some players | Ping depends on each player's distance to the server. Faraway players will feel it |
