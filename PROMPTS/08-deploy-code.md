# B8-Code — Produktionsfähig machen (ein Express-Dienst auf 3002, SQLite, Deploy-Doku)

**Phase:** B8-Code (Code-Teil des Deploys; der Server-Teil — User/systemd/Caddy — macht Laura danach manuell mit Chat-Claude, **nicht** Claude Code). Logische Einheiten siehe §3 — **Granularität entscheidet Code selbst**.
**Ziel:** Die App als **einen** Node/Express-Dienst produktiv lauffähig machen: Express liefert in Prod das **gebaute Frontend** (`frontend/dist`) selbst aus + bedient die API, alles über **einen Port (3002)**, hinter Caddy (HTTPS-Terminierung). **SQLite bleibt** auch in Produktion (wie Einsatzboard/Kasse) — **kein Postgres, kein Schema-Change**.
**Server-Eckdaten (fix, vom echten Server verifiziert):** Port **3002** (3000/3001 belegt), System-User `getraenkekasse`, App-Pfad `/home/getraenkekasse/app`, Dienst `getraenkekasse.service`, Domain `getraenke.einfall.app` → `127.0.0.1:3002`, Server nativ Node+systemd hinter Caddy (kein Docker in Prod). Bind auf **`127.0.0.1`**.
**Source of Truth:** `KONFIGURATION.md` (§2 Stack/Hosting, §10 Roadmap B8). Bei Doku↔Code-Widerspruch gewinnt Code/Realität (CLAUDE.md §2).
**Voraussetzung:** Cleanup gepusht (grüner Backend-Build).
**Erwartung:** **keine neue Dependency** (Static-Serving ist in Express eingebaut), **kein Schema-Change**, **kein `db push`** lokal. Falls Code wider Erwarten was braucht → STOPP + Schritt-0 begründen.
**Modus:** Voll autonom — Code committet selbst, pusht nicht. Kein `Co-Authored-By`.

---

## 1. Arbeitsmodus

Autonom, selbst committen wenn alle drei grün: `pnpm --filter backend test`, `pnpm --filter backend build`, `pnpm --filter frontend build` — **plus** ein lokaler **Prod-Smoke** (siehe §4). STOPP nur bei echtem Blocker. **Kein `git push`.** Bündel mit echtem `git status` + `git log`. Kein `Co-Authored-By`.

---

## 2. Schritt 0 — Recherche (read-only)

`git status -sb` + `git log --oneline -4` (lokal, kein `fetch`). Bericht → `BERICHTE/B8_CODE_SCHRITT0.md` + 5–10 Zeilen. Genau klären (das ist der heikle Teil — Dev vs. Prod-Pfade):
1. **Vite-Dev-Proxy** (`vite.config.ts`): wie wird `/api` auf das Backend gemappt? Schreibt der Proxy das `/api`-Präfix weg (rewrite) oder nicht? → bestimmt, unter welchem Pfad das Backend die Routen real bedient.
2. **Backend-Route-Mounts** (`index.ts`): sind die Routen an **Root** (`/auth`, `/admin`, …) oder unter `/api` gemountet?
3. **Frontend-API-Basis** (`lib/api.ts`): welche Basis-URL nutzt das Frontend (relativ `/api`? absolut?) — diese Basis gilt für **dev und prod gleich** (gebautes Bundle).
4. **`env.ts`** (Zod): welche Variablen (DATABASE_URL, JWT_SECRET, FRONTEND_ORIGIN, APP_BASE_URL, NODE_ENV, PORT)? Defaults?
5. **JWT-Cookie-Optionen** (`auth/jwt.ts`): wie werden `secure` / `sameSite` gesetzt? (Wichtig: hinter Caddy terminiert HTTPS, Express sieht `http` auf 127.0.0.1 → für `Secure`-Cookies muss `trust proxy` + `X-Forwarded-Proto` berücksichtigt werden, sonst hält der Login in Prod nicht.)
6. **CORS** (`index.ts`): aktuell für getrennte Origins (Vite 3001 ↔ 4000). In Prod ist alles **same-origin** (ein Dienst) → CORS wird unnötig/anders.
7. **Build-Outputs**: `backend/dist` + `frontend/dist` — relative Pfade zueinander im Monorepo (`/home/getraenkekasse/app/...`).

Kein `db push` lokal — die DB existiert schon im Dev-Container.

---

## 3. Inhalt

### 3.1 Express liefert in Prod das Frontend aus
- In **Produktion** (`NODE_ENV=production`) liefert das Express-Backend `frontend/dist` als **statische Dateien** aus, mit **SPA-Fallback auf `index.html`** für Nicht-API-Routen (damit `/admin`, `/buchen` etc. + Refresh funktionieren). **Reihenfolge beachten:** API-Routen zuerst, dann Static, dann Fallback — der Fallback darf **keine** API-/Asset-Requests schlucken.
- **`/api`-Konsistenz:** Das gebaute Frontend ruft denselben Pfad wie in Dev (`lib/api.ts`). Stelle sicher, dass derselbe Pfad in Prod **ohne Vite-Proxy** beim Express ankommt — d.h. die API muss unter exakt dem Pfad erreichbar sein, den das Frontend nutzt (ggf. API-Mount in Prod an `/api` anpassen bzw. konsistent zum Dev-Proxy-Verhalten machen). **Dev darf dabei nicht brechen.**
- Im **Dev** bleibt alles wie es ist (Vite 3001 + Express 4000 + Proxy). Nur der Prod-Pfad kommt dazu.

### 3.2 Prod-tauglicher Auth-/Cookie-Pfad hinter Caddy
- `trust proxy` setzen, sodass `X-Forwarded-Proto` (von Caddy) korrekt ausgewertet wird.
- JWT-Cookie in Prod: `secure: true` + `sameSite: 'lax'` (same-origin) — in Dev wie gehabt. So hält die Session hinter HTTPS.
- CORS in Prod: same-origin → entweder deaktivieren oder auf die Domain beschränken; Dev-Verhalten erhalten.

### 3.3 Prod-Konfiguration + Start
- **`.env.production.example`** (oder klar dokumentiert) mit den realen Werten: `NODE_ENV=production`, `PORT=3002`, `DATABASE_URL="file:./data/getraenke.db"` (relativer Pfad unter dem App-Verzeichnis; finaler Speicherort wird beim Deploy gesetzt), `JWT_SECRET=<Platzhalter, beim Deploy ersetzen>`, `APP_BASE_URL=https://getraenke.einfall.app`, ggf. `FRONTEND_ORIGIN` anpassen/entfernen (same-origin).
- **Start-/Build-Skripte**: ein klarer Prod-Start (z.B. `node backend/dist/index.js` mit `NODE_ENV=production`), Build erzeugt `backend/dist` + `frontend/dist`. `prisma generate` ist (aus dem Cleanup) Teil des Backend-Builds.
- **DB-Bootstrap** dokumentieren (nicht ausführen): in Prod wird die SQLite-Datei per `prisma db push` erstellt (es gibt **kein** `migrations/`-Verzeichnis, `db:reset` ist kaputt) + danach `seed` (legt den Erst-Admin an). Genau so in die Deploy-Doku.

### 3.4 Deploy-Doku (`DEPLOY.md` im Repo)
Schritt-für-Schritt-**Vorlage** für den nativen Server (Laura führt sie später manuell aus), mit unseren fixen Werten:
- System-User `getraenkekasse`, App-Pfad `/home/getraenkekasse/app`, Port `3002`.
- Schritte: User anlegen → Repo nach `/home/getraenkekasse/app` → `pnpm install` → `prisma generate` → `pnpm --filter frontend build` + `pnpm --filter backend build` → `.env` aus `.env.production.example` (echte `JWT_SECRET` generieren) → `prisma db push` → `seed` → systemd starten.
- **`getraenkekasse.service`-Unit** (Vorlage): läuft als User `getraenkekasse`, `NODE_ENV=production`, `PORT=3002`, gehärtet (Schreibrechte nur auf `data/`), Restart on-failure.
- **Caddy-Block** (Vorlage): `getraenke.einfall.app { reverse_proxy 127.0.0.1:3002 }` (Auto-HTTPS via Let's Encrypt).
- **Klar markieren:** „Diese Templates gegen die bestehenden `einsatzboard.service` / `kasse.service` + das echte Caddyfile auf dem Server abgleichen, bevor sie übernommen werden" — die exakte Härtung/Pfade können abweichen.

### Bewusst NICHT in B8-Code
- Keine Server-Aktionen (User/systemd/Caddy ausführen) — das macht Laura manuell.
- Kein Postgres, kein Schema-Change, keine neue Dependency.
- Kein `db push`/`seed` lokal ausführen (nur dokumentieren).

---

## 4. Prod-Smoke (lokal, Pflicht vor Self-Commit)

Lokal verifizieren, dass der **eine Prod-Prozess** funktioniert (ohne Vite):
1. `pnpm --filter frontend build` + `pnpm --filter backend build`.
2. Backend mit `NODE_ENV=production` + einem Test-`PORT` starten (DATABASE_URL auf die bestehende Dev-DB zeigen lassen — **nicht** neu seeden).
3. Im Browser/curl gegen diesen einen Port: App-Shell lädt (von Express, nicht Vite), **Login funktioniert**, ein `/api`-Call liefert Daten, **Deep-Link/Refresh** auf einer Unterseite (z.B. `/admin`) lädt korrekt (SPA-Fallback), statische Assets + Icons laden.
4. Ergebnis im Bündel dokumentieren (welcher Port, was geprüft).

---

## 5. Done-Kriterien (Lauras Review)

- [ ] In Prod liefert **ein** Express-Dienst Frontend **und** API aus (lokaler Prod-Smoke grün, im Bündel dokumentiert)
- [ ] Login + `/api` + SPA-Deep-Link funktionieren im Prod-Modus ohne Vite
- [ ] Auth/Cookie prod-tauglich (`trust proxy`, `secure`+`sameSite` in Prod) — Dev unverändert
- [ ] `.env.production.example` + Prod-Start/Build vorhanden; DB-Bootstrap (`db push` + `seed`) dokumentiert
- [ ] `DEPLOY.md` mit systemd-Unit + Caddy-Block (unsere Werte) + „gegen bestehende Dienste abgleichen"-Hinweis
- [ ] `pnpm --filter backend build` + `backend test` (201) + `frontend build` grün; **kein** Schema-Change, **keine** neue Dependency
- [ ] Dev-Setup (Vite 3001 + Express 4000 + Proxy) weiterhin unverändert funktionsfähig

---

## 6. Sandbox-/Test-Hinweise

- Kein `db push`/`db:reset`/`seed` lokal ausführen (nur dokumentieren). Bei stale/Port: `docker restart claude-bwza-getraenke`. Dev: `cd app && pnpm dev`.
- Der Prod-Smoke nutzt die **bestehende** Dev-SQLite (read/write ok), legt aber **keine** neue DB an und seedet nicht.

---

## 7. Abschluss (autonom, ohne Push)

Alle Gates + Prod-Smoke grün → Code committet selbst (Granularität dokumentiert; kein `Co-Authored-By`) → `BERICHTE/B8_CODE_BUENDEL.md` mit echtem `git status` + `git log --oneline -N` + Prod-Smoke-Ergebnis (Port, geprüfte Punkte) + Hinweis auf `DEPLOY.md` → **STOPP ohne Push.** Laura reviewt, testet (lokaler Prod-Smoke), pusht; der Server-Teil folgt manuell mit Chat-Claude.
