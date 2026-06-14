# Phase B2a — Mitglieder-Invite-UI (Admin)

**Ziel:** Der Verwalter kann im Browser neue Mitglieder einladen (Formular: Vorname, Nachname, Email), statt wie bisher nur via `curl`. Der Magic-Link wird wie in B1 erzeugt und (Dev) auf der Konsole ausgegeben.

**Geschätzte Dauer:** 0.5-1 Tag. Mit Schritt-0-Recherche vorab.

**Source of Truth:** `KONFIGURATION.md` (Update 8). Konventionen: `CLAUDE.md`.

---

## WICHTIG — Ablauf nach CLAUDE.md Sektion 3

Diese Phase läuft in zwei getrennten Etappen:

1. **Schritt 0 — Recherche (NUR LESEN, kein Edit, kein Commit).** Du liest den B1-Code und berichtest den Ist-Stand. Danach STOPP.
2. **Laura entscheidet** auf Basis der Recherche, dann kommt der Bau-Prompt für die Sub-Commits.

**In diesem Durchgang machst du NUR Schritt 0.** Kein Code-Edit, kein Commit. Erst lesen und berichten.

---

## Schritt 0 — Recherche-Auftrag

Lies den vorhandenen Code und beantworte die folgenden Fragen. Lege das Ergebnis als Bericht in `BERICHTE/PHASE_B2a_SCHRITT0.md` ab (BERICHTE/ ist per .gitignore ausgeschlossen, also kein Commit nötig). Gib zusätzlich eine kompakte Zusammenfassung im Chat.

### Fragen zum Backend

1. **Invite-Route:** Wie sieht `routes/admin.ts` (oder wo die Invite-Logik liegt) aktuell aus? Welcher genaue Endpunkt, welche Felder erwartet er (Body-Schema), was gibt er zurück?
2. **InviteToken-Modell:** Wie ist `InviteToken` im Prisma-Schema definiert? Welche Felder? (Wir bleiben in B2a bei `InviteToken`, Umbenennung auf `Invite` erst B2b.)
3. **Auth-Middleware:** Wie funktioniert `requireAuth` + `requireAdmin`? Was muss das Frontend mitschicken (Cookie? Header?), damit ein Admin-Request durchgeht?
4. **Email-Adapter:** Wie wird der Magic-Link aktuell ausgegeben? Wo im Code steht das `console.log` (oder Äquivalent)? Gibt es eine Liste schon ausgestellter Invites, die man abfragen kann — oder müsste dafür eine neue Route her?
5. **Gibt es bereits eine Route, um ausgestellte Invites aufzulisten?** (Für die „Liste ausgestellter Invites mit Status" im UI.) Falls nein: vermerken, dass die in B2a neu gebaut werden muss.

### Fragen zum Frontend

6. **App-Struktur:** Wie ist `App.tsx` aufgebaut? Welche Routen existieren (`/`, `/login`, `/set-password`)? Wie funktioniert der `Protected`-Wrapper?
7. **Dashboard:** Wie sieht `Dashboard.tsx` aktuell aus? Wo könnte ein minimaler „Admin"-Einstieg (Button/Link) hin, der nur für `isAdmin`-User sichtbar ist?
8. **Auth-State:** Wie liefert `useAuth` die Info, ob der eingeloggte User Admin ist? Ist `isAdmin` im User-Objekt vorhanden, das vom `/auth/me` (oder Äquivalent) zurückkommt?
9. **API-Client:** Wie ist `lib/api.ts` aufgebaut? Wie macht man einen POST mit Credentials? Gibt es ein Muster für Fehlerbehandlung (`ApiError`)?
10. **Komponenten:** Welche Primitives aus `components/primitives.tsx` lassen sich für ein Invite-Formular wiederverwenden (GlassInput, GlassButton etc.)?

### Abgleich mit KONFIGURATION.md

11. **isAdmin im User-Modell:** Bestätige, dass `User.isAdmin` im B1-Schema existiert. (Update 8 braucht zusätzlich `isLeitung` und `paypalMeLink` — aber NICHT in B2a, nur vermerken dass sie fehlen und später kommen.)
12. **Naming-Drift:** Bestätige den aktuellen Stand der bekannten Inkonsistenzen (`guthaben` vs `guthabenCent`, `InviteToken` vs `Invite`) — nur dokumentieren, nicht beheben.

---

## Was Schritt 0 liefern soll

Ein Bericht `BERICHTE/PHASE_B2a_SCHRITT0.md` mit:
- Antworten auf die 12 Fragen, knapp und konkret (mit Datei-Pfaden und Zeilenangaben wo sinnvoll)
- Eine Einschätzung: Was muss in B2a neu gebaut werden (Backend-Route für Invite-Liste? Frontend-Formular? Admin-Einstieg?), und welche Sub-Commit-Zerlegung schlägst du vor?
- Offene Fragen / Stolpersteine, die Laura entscheiden sollte

Im Chat: 8-12 Zeilen Zusammenfassung.

---

## Verhaltens-Regeln (aus CLAUDE.md)

- **Schritt 0 ist NUR LESEN.** Kein Edit an Code, kein neuer Code, kein Commit.
- Bei widersprüchlichen Quellen oder Unklarheit: STOPP, im Bericht vermerken, Laura fragen — nicht eigenmächtig entscheiden.
- Nach dem Bericht: STOPP. Auf Lauras Entscheidung warten.

---

## Vorgaben für die spätere Bau-Etappe (zur Info, NICHT jetzt umsetzen)

Damit du beim Recherchieren den Zielzustand im Kopf hast:
- **Naming:** B2a bleibt bei `InviteToken` (Umbenennung erst B2b)
- **Admin-Einstieg:** minimal — ein einfacher Button/Link auf dem Dashboard, nur für `isAdmin` sichtbar, führt zu einer Invite-Seite. Kein Profil-Drawer (kommt B5).
- **Invite-Formular:** Vorname, Nachname, Email → POST an die bestehende Invite-Route
- **Invite-Liste:** ausgestellte Invites mit Status (offen / eingelöst / abgelaufen) — falls dafür eine neue Backend-Route nötig ist, wird die in B2a mitgebaut
- **Magic-Link:** bleibt wie in B1 (Dev: Konsolen-Output), kein echter Email-Versand in B2a
