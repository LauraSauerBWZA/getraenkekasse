# Phase B2a — Bau-Etappe: Mitglieder-Invite-UI

**Ziel:** Verwalter kann im Browser Mitglieder einladen (Formular Vorname/Nachname/Email), bekommt den Magic-Link als klickbaren Link angezeigt, und sieht eine Liste ausgestellter Invites mit Status.

**Grundlage:** Schritt-0-Bericht `BERICHTE/PHASE_B2a_SCHRITT0.md` (bereits erstellt).
**Source of Truth:** `KONFIGURATION.md` (Update 8). Konventionen: `CLAUDE.md`.
**Geschätzte Dauer:** 0.5-1 Tag, 4 Sub-Commits.

---

## Entscheidungen (von Laura festgelegt)

- **Naming:** B2a bleibt bei `InviteToken` / `prisma.inviteToken`. Keine Umbenennung (das ist B2b).
- **Keine Schema-Änderung** in B2a. `isLeitung`, `paypalMeLink`, Guthaben-Streichung sind spätere Phasen.
- **Route:** `/admin` (zukunftsoffen, Invite ist erster Inhalt — kein `/admin/invite`).
- **Magic-Link-Anzeige:** fertiger klickbarer Link (`${APP_BASE_URL}/set-password?token=…`) mit Copy-Button, gespeist aus dem `devToken` der POST-Response.
- **Validierung:** Backend vertrauen (wie `Login.tsx`), nur leere Pflichtfelder client-seitig abfangen.
- **Busy-State:** wie `Login.tsx` (`busy` + `disabled` beim Submit).
- **Status „abgelaufen":** Server berechnet beim Request, kein Live-Update nötig.
- **Doppel-Invite gleiche Email:** Backend bleibt wie es ist (legt neuen Token an). Kein Fix in B2a, nur im Kopf behalten.

---

## Sub-Commit-Disziplin (CLAUDE.md §3)

Pro Sub-Commit:
1. Edit ausführen
2. Diff-Bericht in `BERICHTE/PHASE_B2a<N>_DIFF.md`
3. 5-10 Zeilen Zusammenfassung im Chat
4. **STOPP** — auf Lauras Browser-Test + Freigabe warten
5. Erst nach Freigabe: `git commit` (mit `git status` + `git diff --cached` davor zeigen)

**Niemals** committen ohne Freigabe. **Niemals** `git push` (macht Laura vom Mac).

---

## Sub-Commit B2a.1 — Backend: GET /admin/invites

**Aussage:** „GET /admin/invites listet ausgestellte Invites mit abgeleitetem Status."

**Datei:** `app/backend/src/routes/admin.ts`

**Was bauen:**
- Neue Route `GET /admin/invites`, hinter dem bestehenden `requireAuth, requireAdmin`-Vorhang
- Liest alle `InviteToken` (mit zugehörigem User für Name/Email)
- Leitet pro Invite den Status server-seitig ab:
  - `eingeloest` wenn `redeemedAt != null`
  - sonst `abgelaufen` wenn `expiresAt < now`
  - sonst `offen`
- Response:
  ```json
  { "invites": [
    { "id", "userId", "email", "firstName", "lastName",
      "createdAt", "expiresAt", "redeemedAt",
      "status": "offen" | "eingeloest" | "abgelaufen" }
  ] }
  ```
- Sortierung: neueste zuerst (`createdAt desc`)

**Browser-Test (Laura):** `curl` mit Admin-Cookie gegen `/admin/invites` → JSON-Liste. (Claude Code gibt den genauen curl-Befehl im Chat an, inkl. wie man den Cookie aus dem Browser holt.)

**STOPP** nach Diff-Bericht.

---

## Sub-Commit B2a.2 — Dashboard: Admin-Einstieg + Route /admin

**Aussage:** „Dashboard zeigt für Admins einen Einstieg zum Admin-Bereich."

**Dateien:** `app/frontend/src/routes/Dashboard.tsx`, `app/frontend/src/App.tsx`, neue Datei `app/frontend/src/routes/Admin.tsx` (vorerst Placeholder)

**Was bauen:**
- In `Dashboard.tsx`: unterhalb der Guthaben-Karte, über dem Abmelden-Block, ein Admin-Einstieg — nur gerendert wenn `user.isAdmin`. Als `GlassButton variant="ghost"` oder kleines `Glass`-Panel mit Link „Verwaltung" → navigiert nach `/admin`.
- In `App.tsx`: neue Route `/admin` → `Protected(Admin)`. Zusätzlich Client-Gate: wenn `user` nicht `isAdmin`, redirect nach `/`.
- `Admin.tsx`: vorerst nur ein Platzhalter-Screen mit Überschrift „Verwaltung" und einem Zurück-Link. (Inhalt kommt in B2a.3/B2a.4.)

**Browser-Test (Laura):**
- Als Admin eingeloggt → „Verwaltung"-Einstieg sichtbar, Klick führt nach `/admin`
- Als Nicht-Admin (falls testbar) → Einstieg unsichtbar, direkter Aufruf `/admin` redirectet nach `/`

**STOPP** nach Diff-Bericht.

---

## Sub-Commit B2a.3 — Invite-Formular sendet POST und zeigt Magic-Link

**Aussage:** „Admin-Bereich enthält ein Invite-Formular, das einen Magic-Link erzeugt und anzeigt."

**Dateien:** `app/frontend/src/lib/api.ts` (neue Helfer), `app/frontend/src/routes/Admin.tsx`

**Was bauen:**
- In `api.ts`: zwei neue Helfer
  - `adminInvite({email, firstName, lastName})` → POST `/admin/invite`, Response `{user, devToken?}`
  - `adminInvites()` → GET `/admin/invites`, Response `{invites: [...]}` (wird in B2a.4 genutzt, aber hier gleich mit anlegen)
- In `Admin.tsx`: Invite-Formular mit `GlassInput` für Vorname, Nachname, Email (`type="email"`)
  - Submit-Button `GlassButton` mit `busy`-State (wie `Login.tsx`)
  - Client-Check nur: keine Pflichtfelder leer. Sonst Backend vertrauen, `ApiError.message` anzeigen.
  - Bei Erfolg: Erfolgs-Karte (`Glass tone="amber"`?) mit dem **fertigen klickbaren Magic-Link** `${BASE_ohne_/api oder APP_BASE_URL}/set-password?token=${devToken}` + Copy-Button. Hinweis-Text: „Diesen Link an das neue Mitglied weitergeben."
  - Formular nach Erfolg zurücksetzen

**Hinweis Link-Bau:** Der `devToken` ist der Klartext-Token. Der Link muss zur Frontend-URL zeigen (`/set-password?token=…`), so wie `buildInviteUrl` im Backend es tut. Frontend-seitig: `window.location.origin + '/set-password?token=' + encodeURIComponent(devToken)`.

**Browser-Test (Laura):**
- Formular ausfüllen, absenden → Erfolgs-Karte mit klickbarem Link erscheint
- Link kopieren, in neuem Tab öffnen → Set-Password-Seite akzeptiert den Token
- Konsole (Backend) zeigt den Invite-Log

**STOPP** nach Diff-Bericht.

---

## Sub-Commit B2a.4 — Invite-Liste mit Status

**Aussage:** „Admin-Bereich zeigt eine Liste ausgestellter Invites mit Status."

**Datei:** `app/frontend/src/routes/Admin.tsx`

**Was bauen:**
- Unter dem Formular: Liste aller Invites via `api.adminInvites()`, geladen beim Mount + nach jedem erfolgreichen Invite neu
- Pro Invite eine Zeile/Karte (`Glass`): Name, Email, Status-Chip, Ablauf-Datum
- Status-Chip farblich: offen (neutral/amber), eingelöst (grün), abgelaufen (rot/gedämpft)
- Leerzustand: `EmptyState`-Primitive falls keine Invites
- Ladezustand: `Skeleton` oder einfacher „Lädt…"-Text

**Browser-Test (Laura):**
- Liste zeigt die bisher ausgestellten Invites
- Nach neuem Invite refresht die Liste, neuer Eintrag erscheint als „offen"
- Ein eingelöster Invite (das Test-Onboarding aus B2a.3) zeigt „eingelöst"

**STOPP** nach Diff-Bericht.

---

## Phase-Abschluss

Nach B2a.4 + Freigabe:
- `BERICHTE/PHASE_B2a_ABSCHLUSS.md` mit Commit-Hashes aller vier Sub-Commits + kurzer Zusammenfassung
- Im Chat: Hinweis, dass Laura pushen kann (`git push` vom Mac)

---

## Was NICHT in B2a gehört

- ❌ Keine Schema-Änderung (kein `isLeitung`, `paypalMeLink`, keine Umbenennung)
- ❌ Kein Profil-Drawer (B5)
- ❌ Kein „Invite widerrufen / erneut senden"
- ❌ Kein echter Email-Versand
- ❌ Kein `git push`
- ❌ Kein Commit ohne Lauras Freigabe
