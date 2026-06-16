# DEPLOY.md — Bergwacht Getränkekasse (B8, nativer Server hinter Caddy)

**Vorlage** für das manuelle Deployment durch Laura (Server-Teil mit Chat-Claude). Ein
einziger Node/Express-Dienst liefert in Produktion das gebaute Frontend **und** die API
über **einen Port (3002)** aus, gebunden an `127.0.0.1`, hinter Caddy (HTTPS). **SQLite
bleibt** auch in Prod — kein Postgres, kein Schema-Change.

> ⚠️ **Templates vor Übernahme abgleichen:** systemd-Unit und Caddy-Block unten gegen die
> bereits laufenden `einsatzboard.service` / `kasse.service` und das **echte Caddyfile** auf
> dem Server prüfen — exakte Härtung, User-Setup und Pfade können dort abweichen.

## Fixe Werte

| Was | Wert |
|---|---|
| System-User | `getraenkekasse` |
| Clone-Ziel (Repo) | `/home/getraenkekasse/app` |
| pnpm-Monorepo (Workspace-Root) | `/home/getraenkekasse/app/app` *(das Repo enthält den Code im Unterordner `app/`)* |
| Backend-Workdir | `/home/getraenkekasse/app/app/backend` |
| Port | `3002` (3000/3001 belegt), Bind `127.0.0.1` |
| Dienst | `getraenkekasse.service` |
| Domain | `getraenke.einfall.app` → `127.0.0.1:3002` |
| SQLite-Datei | `…/app/backend/prisma/data/getraenke.db` *(relativ zu `schema.prisma`)* |

Im Folgenden: `APP=/home/getraenkekasse/app/app` (Monorepo-Root).

## 1. System-User anlegen

```bash
sudo adduser --system --group --home /home/getraenkekasse getraenkekasse
```

## 2. Repo holen

```bash
sudo -u getraenkekasse git clone <REPO-URL> /home/getraenkekasse/app
cd /home/getraenkekasse/app/app          # = $APP, der pnpm-Workspace
```

(Node ≥20 und `pnpm@11.1.3` müssen verfügbar sein — z.B. via `corepack enable`.)

## 3. Dependencies + Prisma-Client

```bash
sudo -u getraenkekasse pnpm install --frozen-lockfile
sudo -u getraenkekasse pnpm --filter backend prisma generate   # (auch Teil des Backend-Builds)
```

## 4. Bauen (Frontend + Backend)

```bash
sudo -u getraenkekasse pnpm --filter frontend build   # liest .env.production → VITE_API_URL=/api
sudo -u getraenkekasse pnpm --filter backend build     # prisma generate && tsc → backend/dist
```

Ergebnis: `app/frontend/dist` (App-Shell + Assets) und `app/backend/dist/index.js`.
Der Prod-Server liefert `frontend/dist` relativ zu `backend/dist/index.js`
(`../../frontend/dist`) aus — cwd-unabhängig.

## 5. Produktions-`.env`

```bash
cd $APP/backend
cp .env.production.example .env
# JWT_SECRET durch echten Zufallswert ersetzen:
sed -i "s|REPLACE_ME.*|$(openssl rand -base64 48)|" .env
```

Inhalt (Vorlage `backend/.env.production.example`): `NODE_ENV=production`, `PORT=3002`,
`DATABASE_URL="file:./data/getraenke.db"`, `JWT_SECRET=<echt>`,
`APP_BASE_URL=https://getraenke.einfall.app`.
`FRONTEND_ORIGIN` wird in Prod nicht gebraucht (same-origin, CORS ist aus).

## 6. DB-Bootstrap (einmalig) — `db push` + `seed`

Es gibt **kein** `migrations/`-Verzeichnis; `db:reset` ist nicht nutzbar. Erst-Anlage der
SQLite-Datei per `prisma db push`, danach Seed (legt den Erst-Admin an):

```bash
cd $APP/backend
mkdir -p prisma/data                                  # Verzeichnis muss existieren
sudo -u getraenkekasse pnpm prisma db push            # erstellt prisma/data/getraenke.db
sudo -u getraenkekasse pnpm seed                       # Erst-Admin + Drink-Seeds; gibt Magic-Link in der Konsole aus
```

Den ausgegebenen Magic-Link aufbewahren — damit setzt der Erst-Admin sein Passwort
(`/set-password?token=…`).

## 7. systemd-Unit (Vorlage)

`/etc/systemd/system/getraenkekasse.service`:

```ini
[Unit]
Description=Bergwacht Getraenkekasse (Express, SQLite)
After=network.target

[Service]
Type=simple
User=getraenkekasse
Group=getraenkekasse
WorkingDirectory=/home/getraenkekasse/app/app/backend
Environment=NODE_ENV=production
Environment=PORT=3002
# JWT_SECRET / DATABASE_URL / APP_BASE_URL kommen aus backend/.env (dotenv)
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=3

# Härtung (gegen einsatzboard.service/kasse.service abgleichen):
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
# Schreibrechte NUR auf das SQLite-Verzeichnis (db + -journal/-wal/-shm):
ReadWritePaths=/home/getraenkekasse/app/app/backend/prisma/data

[Install]
WantedBy=multi-user.target
```

> `ProtectHome=true` + `ReadWritePaths=…` erlaubt dem Dienst nur den DB-Ordner zu schreiben.
> Falls der Prozess das Repo unter `/home/...` lesen können muss (tut er — Code/dist liegen
> dort), ggf. `ProtectHome=read-only` statt `true` setzen und gegen die Schwester-Dienste
> abgleichen.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now getraenkekasse.service
sudo systemctl status getraenkekasse.service
curl -fsS http://127.0.0.1:3002/api/health    # {"status":"ok"}
```

## 8. Caddy-Block (Vorlage)

In das bestehende Caddyfile aufnehmen (Auto-HTTPS via Let's Encrypt):

```caddy
getraenke.einfall.app {
	reverse_proxy 127.0.0.1:3002
}
```

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Caddy setzt `X-Forwarded-Proto`; der Dienst hat `trust proxy` aktiv → die Secure-Cookie-
Session (`secure:true`, `sameSite:lax`) hält hinter HTTPS.

## 9. Smoke nach Go-Live

- `https://getraenke.einfall.app/` lädt die App-Shell.
- Login funktioniert, Session hält über Reload (Secure-Cookie).
- Deep-Link/Refresh auf `/admin` lädt (SPA-Fallback).
- `https://getraenke.einfall.app/api/health` → `{"status":"ok"}`.

## Updates später

```bash
cd $APP && sudo -u getraenkekasse git pull
sudo -u getraenkekasse pnpm install --frozen-lockfile
sudo -u getraenkekasse pnpm --filter frontend build
sudo -u getraenkekasse pnpm --filter backend build
sudo systemctl restart getraenkekasse.service
```

Schema-Änderungen (sollten in B8 keine sein) bräuchten ein erneutes `prisma db push`.
</content>
