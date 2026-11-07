# Testing the CRM on an always-on host

Netlify runs the CRM as serverless functions in US East, while the database
is in London. Every page therefore crosses the Atlantic and can hit a cold
start. An always-on container in London removes both problems. This guide
gets you a like-for-like test so you can feel the difference.

The repo now has everything a container host needs:

- `Dockerfile` builds a small self-contained server (Next.js standalone).
- `/api/health` answers `{"ok":true,"db_ms":12}`. The `db_ms` figure is the
  time for one round trip to Supabase, which is what decides how fast pages feel.
- `fly.toml` is ready for Fly.io in London.

## Option 1: Oracle Cloud Always Free (free, London)

The only genuinely free, always-on option with a London region.

1. Sign up at oracle.com/cloud/free. Pick **UK South (London)** as the home
   region. This cannot be changed later. A card is needed for identity checks
   but is not charged on Always Free.
2. Create a compute instance: shape **VM.Standard.A1.Flex** (ARM), 1 OCPU and
   6 GB is plenty. Image: Ubuntu 24.04. Download the SSH key it offers.
   If it says "out of capacity", try another availability domain or try again later.
3. In the instance's subnet security list, add an ingress rule for TCP port 80
   and 443 from 0.0.0.0/0.
4. SSH in and install Docker and Caddy (Caddy gives you HTTPS automatically):

   ```bash
   sudo apt-get update && sudo apt-get install -y docker.io caddy git
   sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT && sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
   git clone https://github.com/finleymurray/blackthorn-crm && cd blackthorn-crm
   ```

5. Create `.env.production` with the same values Netlify has
   (`DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, `DEMO_PASSWORD`), then:

   ```bash
   set -a; . ./.env.production; set +a
   sudo docker build -t blackthorn-crm \
     --build-arg NEXT_PUBLIC_SUPABASE_URL --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY --build-arg NEXT_PUBLIC_APP_URL .
   sudo docker run -d --name crm --restart unless-stopped -p 127.0.0.1:3000:3000 --env-file .env.production blackthorn-crm
   ```

6. Point Caddy at it. With a domain, use the domain. Without one, use
   `<public-ip>.sslip.io`, which resolves to your IP and gets a real certificate:

   ```bash
   echo '<public-ip>.sslip.io { reverse_proxy 127.0.0.1:3000 }' | sudo tee /etc/caddy/Caddyfile
   sudo systemctl reload caddy
   ```

Things to know:

- Oracle may reclaim Always Free instances that sit idle for a week (very low
  CPU, network and memory use). A demo that people actually use is fine.
- Reports in 2026 suggest the free ARM allowance may have been reduced. A
  1 OCPU, 6 GB machine fits inside either figure.
- The same box can later run Coolify to host the website and CoreLink too.

## Option 2: Fly.io in London (about £3 a month, least effort)

Not free, but the quickest real test. One small machine in London kept on
permanently costs roughly £3 a month at current prices.

```bash
curl -L https://fly.io/install.sh | sh
fly auth signup            # or: fly auth login
fly launch --no-deploy --copy-config --name blackthorn-crm
fly secrets set DATABASE_URL='...' SUPABASE_SERVICE_ROLE_KEY='...' DEMO_PASSWORD='...'
fly deploy --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY='...'
```

`fly.toml` already sets London, keeps one machine running at all times and
checks `/api/health`. The app appears at https://blackthorn-crm.fly.dev.

## Free options that will not give a fair test

- **Koyeb free** sleeps after an hour with no traffic and only runs in
  Frankfurt or Washington.
- **Render free** sleeps after 15 minutes.

Both would reintroduce the cold starts you are trying to measure away.

## How to compare

Open the same page on both sites a few times, for example the support inbox.
Then compare `/api/health` on each: Netlify will show a much larger `db_ms`
because its function runs in Ohio. On a London host it should be in single
or low double figures.
