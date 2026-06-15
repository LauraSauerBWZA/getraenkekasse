# Phase B2j — Leitung-Rolle (Recht vergeben + Read-only-Kassen-Einsicht)

**Phase:** B2j. Logische Einheiten siehe §3 — **Commit-Granularität entscheidet Code selbst** und dokumentiert sie.
**Source of Truth:** `KONFIGURATION.md` **Update 9** — §4 (Rollen, Leitung-Rechte), §5.1 (`isLeitung`), §7.3 (Leitung-Bereich), §9 (DSGVO/Leitung-Einsicht), §10 (Roadmap), §11/§12.
**Voraussetzung:** Cleanup-AUSLAGE abgeschlossen (`origin/main = 3d1a2c4`). `isLeitung` liegt **schon im User-Schema** (B2e, §12). **Kein Schema-Change, kein `db push`.**
**Modus:** Voll autonom — Code committet selbst, pusht nicht. Kein `Co-Authored-By`.

---

## 1. Arbeitsmodus (volle Autonomie, steht in CLAUDE.md)

Autonom bauen, keine Echtzeit-Rückfragen, Granularität selbst wählen + dokumentieren, selbst committen wenn Tests + Typecheck + Frontend-Build grün. STOPP nur bei echtem Blocker. **Kein `git push`** (Push = Laura). Bündel-Bericht mit echtem `git status` + `git log --oneline -N`. **Kein `Co-Authored-By`.**

---

## 2. Schritt 0 — Recherche (read-only)

Session-Start: `git status -sb` + `git log --oneline -4` (lokal, kein `git fetch`). Bericht in `BERICHTE/PHASE_B2j_SCHRITT0.md` + 5–10 Zeilen. Prüfen:
1. **`isLeitung`** im User-Schema bestätigen (Feld existiert seit B2e, default false). Kein `db push`.
2. **`/me`-Auth-Endpoint** (`routes/auth.ts`): liefert es aktuell `isAdmin`? → `isLeitung` mit ausliefern.
3. **`kasseRouter`** (`routes/kasse.ts`): wie sind die Guards gesetzt (Router-Level `requireAdmin` vs. per-Route)? → die zwei **GET**-Endpoints (`summary`, `historie`) sollen für **Admin ODER Leitung** lesbar werden, die **POST**-Aktionen (`buchung`, `einlage`) bleiben **Admin-only**.
4. **`requireAdmin`-Middleware** (`auth/middleware.ts`): als Muster für eine neue `requireAdminOrLeitung` (lesend).
5. **Admin-Einstieg/Routing-Muster** (`Admin.tsx`, `App.tsx` `Protected > AdminOnly`, wie das Frontend `isAdmin` aus `/me` nutzt): → analoger **Leitung-Einstieg** + Rollen-Gate. **Keinen** vollen ProfileDrawer bauen (das ist B5) — den bestehenden Einstiegs-Pattern spiegeln.
6. **Mitglied-Detail** (`AdminMitgliedDetail.tsx`, B2g): Andockstelle für den Admin-Toggle „Leitung-Recht".

Kein `db push`, kein Blocker erwartet → durchbauen.

---

## 3. Inhalt

### Backend — Leitung-Lesezugriff

- **`/me`** liefert zusätzlich `isLeitung` (analog `isAdmin`), damit das Frontend die Rolle kennt.
- **`requireAdminOrLeitung`**-Guard (lesend): erlaubt `isAdmin` **oder** `isLeitung`.
- **`kasseRouter` umbauen** auf per-Route-Guards (falls noch Router-Level-`requireAdmin`): 
  - `GET /admin/kasse/summary` → `requireAdminOrLeitung`
  - `GET /admin/kasse/historie` → `requireAdminOrLeitung`
  - `POST /admin/kasse/buchung`, `POST /admin/kasse/einlage` → **bleiben `requireAdmin`**
- **Wichtig (DSGVO §9):** `summary` liefert die Mitglieder-Guthaben **als eine Summe** (kein Pro-Person-Wert) — das ist Leitung-safe und bleibt so. **Keine** anderen Endpoints für Leitung öffnen: `GET /admin/users`, `GET /admin/users/:id`, Korrektur, Storno, Aufladung-Bestätigen, Drinks-CRUD, Invite bleiben **`requireAdmin`** (Leitung bekommt dort 403).
- Tests: Leitung darf `summary`/`historie` lesen (200); Leitung auf `buchung`/`einlage` → 403; Leitung auf `GET /admin/users` + `:id` + Korrektur/Storno → 403; Mitglied (weder Admin noch Leitung) auf Kassen-GET → 403.

### Backend — Leitung-Recht vergeben/entziehen (Admin-only)

- Endpoint (Form entscheidet Code, z.B. `POST /admin/users/:id/leitung` oder `PATCH`), `requireAdmin`: setzt `User.isLeitung` true/false.
- **Nur `isLeitung`** — `isAdmin` setzen (Verwalter ernennen) ist **B2k**, hier ausdrücklich nicht.
- Tests: Admin kann setzen/entziehen; Nicht-Admin → 403; unbekannte ID → 404.

### Frontend — Leitung-Ansicht + Recht-Toggle

- **Read-only Leitung-Kassen-Ansicht** (§7.3): Vereinsvermögen-Hero, Töpfe je Verwalter, Bar-Vereinskasse, Deckungs-Card (rot bei negativ), **Gesamtsumme Mitglieder-Guthaben (eine Zahl)**, Kassen-Historie (read-only). **Keine Aktions-Sheets, keine Buttons.** Nutzt `summary` + `historie`.
- **Rollen-Gate + Einstieg:** Route (z.B. `/leitung`) hinter einem Gate „Admin **oder** Leitung"; Einstieg analog zum Admin-Einstieg, sichtbar wenn `isLeitung` (oder `isAdmin`). Admins haben über `/admin/kasse` ohnehin die volle Ansicht — der Leitung-View ist v.a. für Leitung-ohne-Admin.
- **Admin-Toggle „Leitung-Recht"** im Mitglied-Detail (B2g `AdminMitgliedDetail`): vergeben/entziehen, ruft den neuen Endpoint, aktualisiert die Ansicht.
- `lib/api.ts`: `setLeitung` (o.ä.); `/me`-Typ um `isLeitung` erweitern.

### Bewusst NICHT in B2j

- **Sortenstatistik für Leitung** — kommt mit **B3** (dann erhält Leitung sie read-only).
- **Verwalter ernennen (isAdmin), paypal.me, Lastverteilung** — **B2k**.
- **Voller ProfileDrawer / Design-Politur** — **B5**.
- **Kein Schema-Change.**

---

## 4. Done-Kriterien (Lauras async Review)

- [ ] Admin: im Mitglied-Detail „Leitung-Recht" vergeben/entziehen → Toggle wirkt
- [ ] Leitung-User (nicht Admin) sieht einen Einstieg in die **read-only Kassen-Übersicht**: Vereinsvermögen, Töpfe je Verwalter, Box, Deckung, **eine** Mitglieder-Guthaben-Summe, Historie — **keine** Aktions-Buttons
- [ ] Leitung-User kommt **nicht** an Mitglieder-Liste/-Detail, Korrektur, Storno, Kassen-Aktionen (kein UI; Backend 403)
- [ ] Leitung sieht **keine** Einzelsalden und **keine** Trinkjournale
- [ ] `pnpm --filter backend test` grün, Frontend-`build` grün

---

## 5. Sandbox-/Test-Hinweise

- Kein `db push`, kein `db:reset` (kaputt). Bei hängendem Prozess `docker restart claude-bwza-getraenke` (vom Mac). Dev: `cd app && pnpm dev`.
- **Browser-Test braucht zwei Logins:** Als Admin (Laura) einem Test-Mitglied das Leitung-Recht geben, dann als dieses Mitglied einloggen (zweiter Browser/Inkognito), um die read-only Ansicht zu sehen. Im Bündel-Bericht eine konkrete Schritt-Anleitung dafür geben.

---

## 6. Abschluss (autonom, ohne Push)

Tests/Typecheck/Frontend-Build grün → Code committet selbst (Granularität dokumentiert; kein `Co-Authored-By`) → `BERICHTE/PHASE_B2j_BUENDEL.md` mit echtem `git status` + `git log --oneline -N` + Browser-Test-Anleitung (Zwei-Login-Ablauf) → **STOPP ohne Push.** Laura reviewt, testet, pusht.
