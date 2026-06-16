# B6 — PWA (installierbar machen)

**Phase:** B6 (Roadmap §10). Logische Einheiten siehe §3 — **Granularität entscheidet Code selbst** und dokumentiert sie.
**Ziel:** Die App auf dem Handy zum Homescreen hinzufügbar machen, startet dann **standalone** (ohne Browser-Leiste) mit dem **BergMark-Icon**. Sauberes Update-Verhalten (kein Stale-Cache).
**Source of Truth:** `KONFIGURATION.md` §2 (PWA ab B6), §8 (Design-Tokens/Farben), §10 (Roadmap). Design-Farben aus `design/design-tokens.css`.
**Voraussetzung:** Account-Block gepusht.
**Freigegebene Dependency:** **`vite-plugin-pwa`** (von Laura freigegeben) — **kein STOPP**. Falls für die **Icon-Erzeugung aus dem BergMark-SVG** ein Rasterizer/Assets-Generator nötig ist (z.B. `@vite-pwa/assets-generator`, `sharp` o.ä.), zählt das als **dev-only** Teil derselben PWA-Freigabe — leichtesten Weg wählen, **dokumentieren**, kein STOPP. Sonst keine weiteren neuen Dependencies.
**Modus:** Voll autonom — Code committet selbst, pusht nicht. Kein `Co-Authored-By`.

> **Wichtige Test-Einschränkung (unbedingt beachten):** Ein **Service-Worker registriert nur in einem Secure Context** — also über **HTTPS oder `localhost`**, **nicht** über die LAN-IP per `http://192.168.178.186:3001`. Heißt: **Service-Worker/Offline + Android-Install-Prompt sind erst nach dem HTTPS-Deploy (B8) voll testbar.** In dieser Phase wird auf dem **Mac über `localhost`** verifiziert (dort registriert der SW), der Rest ist Deploy-Verifikation in B8. Bitte im Bündel klar so kennzeichnen — **kein** „funktioniert auf dem Handy"-Versprechen aus der Sandbox.

---

## 1. Arbeitsmodus

Autonom, selbst committen wenn Frontend-Build grün + Backend-Tests unverändert grün. STOPP nur bei echtem Blocker. **Kein `git push`.** Bündel mit echtem `git status` + `git log`. Kein `Co-Authored-By`.

---

## 2. Schritt 0 — Recherche (read-only)

`git status -sb` + `git log --oneline -4` (lokal, kein `fetch`). Bericht → `BERICHTE/B6_PWA_SCHRITT0.md` + 5–10 Zeilen. Prüfen:
1. **`vite.config.ts`** (Frontend): aktuelle Plugin-Liste, Build-Output (`dist/`), Base-Path.
2. **`index.html`**: vorhandene `<head>`-Meta-Tags (theme-color? viewport?).
3. **BergMark**: wo das Logo-SVG liegt (Komponente/Pfad) — Vorlage fürs Icon. Geometrie/Farben für eine saubere Rasterung auf **dunklem** Hintergrund (Charcoal) mit Safe-Zone für das **maskable** Icon.
4. **Routing**: React-Router-Routen (für den SW-`navigateFallback` auf `index.html`, damit Deep-Links/Refresh in der installierten App funktionieren).
5. **API-Pfad**: `/api` (über Vite-Proxy, Account-A/relative Basis) — muss vom SW-Caching **ausgenommen** bleiben (Daten immer frisch).

---

## 3. Inhalt

### 3.1 vite-plugin-pwa einrichten
- `vite-plugin-pwa` als Frontend-Plugin, **`registerType: 'autoUpdate'`** (saubere Updates, gegen Stale-Cache).
- **Precache** nur den App-Shell / die gebauten statischen Assets (Workbox-Default). **`/api`-Requests NICHT cachen** (NetworkOnly bzw. nicht matchen) — Daten kommen immer live.
- **`navigateFallback` auf `index.html`** (SPA-Routing in standalone funktioniert, auch bei Refresh auf Unterseiten).
- SW-Registrierung im Frontend-Entry.

### 3.2 Web-Manifest
- `name`: „Bergwacht Getränkekasse", `short_name`: „Getränke" (Laura kann später ändern).
- `display: standalone`, `start_url: '/'`, `scope: '/'`, `orientation: 'portrait'`.
- `background_color` + `theme_color` aus den Design-Tokens (dunkles Charcoal als Grund, damit der Splash/Start dunkel wie die App ist).

### 3.3 Icons aus dem BergMark
- Aus dem bestehenden BergMark-Logo PNGs erzeugen: **192×192**, **512×512**, **maskable 512×512** (mit Safe-Zone-Padding auf dunklem Grund), **apple-touch-icon 180×180**. Als statische Assets ablegen + im Manifest/Head verlinken. Erzeugung dev-only (siehe Freigabe oben), die **fertigen PNGs werden committet**.

### 3.4 iOS- + Head-Meta
- `apple-touch-icon`-Link, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style` (dunkel passend), `theme-color`-Meta. (iOS „Zum Home-Bildschirm" nutzt Manifest + apple-touch-icon, ohne SW.)

### 3.5 Doku
`KONFIGURATION.md`: PWA-Status in §2/§10 auf „umgesetzt (B6)" + kurzer Changelog (Update 14): installierbar, vite-plugin-pwa autoUpdate, BergMark-Icons, SW nur im Secure Context (voll ab HTTPS/B8). Diff im Bündel.

### Bewusst NICHT in B6
- Offline-**Daten** (Sync/Queue) — out of scope; offline lädt höchstens der App-Shell, Daten brauchen Netz.
- Push-Notifications — out of scope.
- Keine Backend-Änderung, keine Logik-/Schema-Änderung.

---

## 4. Done-Kriterien (Lauras Review)

- [ ] `pnpm --filter frontend build` erzeugt **Manifest + Service-Worker + Icon-PNGs** im `dist/` (im Bündel auflisten)
- [ ] Auf dem **Mac über `localhost`**: App installierbar / SW registriert (DevTools → Application → Manifest ok, Service Worker aktiv), Icon = BergMark, Start standalone
- [ ] `navigateFallback` greift: Refresh auf einer Unterseite (z.B. `/admin`) lädt korrekt
- [ ] `/api`-Calls werden **nicht** vom SW gecacht (Daten frisch)
- [ ] `vite-plugin-pwa` (+ ggf. dev-only Icon-Generator) als einzige neue Dependency(s), dokumentiert
- [ ] Backend-Tests unverändert grün (197), Frontend-Build grün
- [ ] Bündel kennzeichnet klar: **Handy-Install voll erst ab HTTPS/B8** verifizierbar

---

## 5. Sandbox-/Test-Hinweise

- Kein `db push`/`db:reset`. Bei stale: `docker restart claude-bwza-getraenke` (Mac). Dev: `cd app && pnpm dev`.
- **Verifikation auf dem Mac:** `localhost:3001` (Secure Context → SW registriert). DevTools → **Application**: Manifest (Icon, Name, theme), **Service Workers** (aktiv), **Cache Storage** (Shell drin, kein `/api`). Build prüfen: `dist/manifest.webmanifest`, SW-Datei, Icon-PNGs vorhanden.
- **Handy-Test** macht Laura **nach B8** (HTTPS) — in dieser Phase nicht erzwingen.

---

## 6. Abschluss (autonom, ohne Push)

Frontend-Build grün + Backend-Tests grün → Code committet selbst (Granularität dokumentiert; kein `Co-Authored-By`) → `BERICHTE/B6_PWA_BUENDEL.md` mit echtem `git status` + `git log --oneline -N` + Liste der `dist/`-PWA-Artefakte + Mac-Verifikations-Schritte + klarer HTTPS/B8-Hinweis → **STOPP ohne Push.** Laura reviewt, testet (Mac), pusht.
