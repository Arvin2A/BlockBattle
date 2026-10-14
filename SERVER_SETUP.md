# Hosting the BlockBattle online server (24/7 Linux box)

This turns a Linux machine into the online server that the GitHub Pages and InfinityFree
versions of the game connect to. Everything is done over SSH. The commands are for
Debian/Ubuntu (`apt`); other distros work too, just with their own package manager.

How it fits together:

```
GitHub Pages / InfinityFree  ── serve the game files (unchanged)
          player's browser   ── wss://play.yourdomain.com/mp ──►  your Linux box
                                                                   (queue + one hidden Chrome tab per match)
```

## 0. Check the machine

```bash
uname -m                 # x86_64 = normal Chrome works. aarch64/arm = use chromium (step 2)
nproc && free -h         # CPU cores and RAM
cat /etc/os-release      # which distro
```

Each match needs about 400 MB of RAM and part of a CPU core. With 15 GB, **CPU is the real
limit, not RAM**. Start with 6 matches and raise it if `htop` stays calm during matches.

## 1. A separate user for the server

So the game server can't touch anything else on the machine:

```bash
sudo adduser --disabled-password --gecos "" blockbattle
```

## 2. Install Node.js and Chrome

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git

# Google Chrome (runs fine with no screen/desktop, it's used headless)
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo apt install -y ./google-chrome-stable_current_amd64.deb
rm google-chrome-stable_current_amd64.deb
# ARM machine instead?  sudo apt install -y chromium
```

## 3. Get the game and test it

```bash
sudo -iu blockbattle                      # become the blockbattle user
git clone https://github.com/Arvin2A/BlockBattle.git
cd BlockBattle
npm ci
npm run build
HOST=127.0.0.1 npm run server             # should say "BlockBattle LAN server is running!"
```

In a second SSH window: `curl http://127.0.0.1:8080/mp/status` should print
`{"online":0,"queued":0,"matches":0}`. Stop the test with Ctrl+C, then `exit` back to your user.

## 4. Run it 24/7 with systemd

Like a Minecraft server, but systemd restarts it if it crashes and starts it on boot.

```bash
sudo cp /home/blockbattle/BlockBattle/server/deploy/blockbattle.service /etc/systemd/system/
sudo nano /etc/systemd/system/blockbattle.service     # put your InfinityFree address in BB_ALLOWED_ORIGINS
sudo systemctl daemon-reload
sudo systemctl enable --now blockbattle
systemctl status blockbattle            # should be "active (running)"
journalctl -u blockbattle -f            # live logs (matches, joins), Ctrl+C to stop watching
```

## 5. Make it reachable from the internet (with HTTPS)

GitHub Pages is `https://`, so browsers only allow a secure `wss://` connection, which means
the server needs a real domain and certificate. Pick ONE option.

### Option A (recommended): Cloudflare Tunnel
No router port forwarding, your home IP stays hidden, HTTPS is automatic, and Cloudflare
absorbs attacks. You need a domain on a free Cloudflare account (about $10/year from
Cloudflare or any registrar).

```bash
# install cloudflared (see developers.cloudflare.com for other distros)
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo apt install -y ./cloudflared.deb && rm cloudflared.deb

cloudflared tunnel login                         # opens a link, log in with your Cloudflare account
cloudflared tunnel create blockbattle
cloudflared tunnel route dns blockbattle play.YOURDOMAIN.com
```

Create `~/.cloudflared/config.yml` (the tunnel ID was printed by `tunnel create`):

```yaml
tunnel: <TUNNEL-ID>
credentials-file: /home/<your-user>/.cloudflared/<TUNNEL-ID>.json
ingress:
  - hostname: play.YOURDOMAIN.com
    service: http://127.0.0.1:8080
  - service: http_status:404
```

```bash
sudo cloudflared service install       # runs the tunnel 24/7 too
```

Your server address is now **`wss://play.YOURDOMAIN.com/mp`**.

### Option B (free): DuckDNS + port forwarding + Caddy
Free, but your home IP is public and you need router access. Some internet providers block
ports 80/443 at home, and then this option won't work.

1. Make a free subdomain at duckdns.org (e.g. `blockbattle.duckdns.org`) and follow their
   "install" page to keep it pointed at your home IP (a cron job).
2. On your router, forward TCP ports **80 and 443** to this machine's LAN IP (same idea as
   forwarding 25565 for Minecraft).
3. Install Caddy (`sudo apt install -y caddy`) and replace `/etc/caddy/Caddyfile` with:
   ```
   blockbattle.duckdns.org {
       reverse_proxy 127.0.0.1:8080
   }
   ```
   then `sudo systemctl reload caddy`. Caddy gets the HTTPS certificate by itself.

Your server address is **`wss://blockbattle.duckdns.org/mp`**.

## 6. Turn on the ONLINE button on your websites

On GitHub: **repo > Settings > Secrets and variables > Actions > Variables > New repository
variable**

- Name: `MP_SERVER_URL`
- Value: your server address from step 5, e.g. `wss://play.YOURDOMAIN.com/mp`

Then re-run the deploy workflow (Actions tab > "Deploy to GitHub Pages and InfinityFree" >
Run workflow). After it finishes, the ONLINE button appears on both sites. Delete the
variable and redeploy to hide it again. People can also play directly at
`https://play.YOURDOMAIN.com/BlockBattle/`.

## Updating

Whenever you push game changes, update the server too, so the server and the website run
the same version (an outdated tab shows a "refresh the page" message):

```bash
sudo -iu blockbattle bash -c 'cd BlockBattle && git pull && npm ci && npm run build'
sudo systemctl restart blockbattle
```

Restarting ends any matches in progress, so do it when nobody is playing.

## Troubleshooting

| Problem | Check |
|---|---|
| ONLINE button missing on the website | `MP_SERVER_URL` variable set? Deploy re-run after setting it? |
| Lobby says "Could not reach the online server" | `systemctl status blockbattle`, tunnel/Caddy running, the address ends in `/mp` |
| Connects from one site but not the other | Its exact address (`https://...`, no trailing `/`) is in `BB_ALLOWED_ORIGINS` |
| "Match crashed on the server" | `journalctl -u blockbattle -n 100`: is Chrome installed? Out of memory? |
| Laggy | Players far from New York have higher ping, there's no fix for distance except more servers |
