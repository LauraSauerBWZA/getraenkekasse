# UI-Fix 3 — Horizontal-Scroll-Ursache beheben + „Mitglied einladen" als eigene Unterseite

**Typ:** reiner Frontend-Fix (CSS-Ursachenbehebung + Routing/Struktur-Umbau). **Kein Schema, keine neue Dependency, kein Backend.**
**Voraussetzung:** Baut auf dem aktuellen `main` auf (alle bisherigen Fixes sind live). Bereits live: PWA-Layout, Mailtext/Magic-Link, Eingabefeld-Kontrast, Drink-Erweiterung.
**Modus:** Voll autonom — Code committet selbst, pusht nicht. Kein `Co-Authored-By`. Granularität: **zwei** logische Einheiten (siehe §3).

---

## 1. Arbeitsmodus

Autonom, selbst committen wenn `pnpm --filter frontend build` grün + `pnpm --filter backend test` unverändert grün. STOPP nur bei echtem Blocker. **Kein `git push`** (Laura vom Mac). Bündel mit echtem `git status` + `git log`.

---

## 2. Schritt 0 — Recherche (read-only, PFLICHT)

`git status -sb` + `git log --oneline -4` (lokal, kein `fetch`). Bericht → `BERICHTE/UI_FIX3_SCHRITT0.md` + 5–10 Zeilen Chat.

### 2.1 Horizontal-Scroll — URSACHE finden, nicht nur Symptom behandeln
Die App lässt sich auf dem iOS-PWA **immer noch** horizontal verschieben — trotz `overflow-x: clip` (Layout-Fix) **und** `overscroll-behavior-x: none` (Wisch-Fix). Das heißt: **irgendein Element ist breiter als der Viewport** und erzeugt echten Overflow. **Erst die Quelle identifizieren**, dann gezielt fixen. Typische Verdächtige systematisch prüfen:
- Elemente mit `width: 100vw` (inkl. Scrollbar-Breite → minimal breiter als der sichtbare Bereich)
- **negative Margins** (z.B. Full-Bleed-Hintergründe, `margin-left: -X`) die über den rechten Rand ragen
- feste `min-width` / breite Grids / Flex-Container, die nicht umbrechen
- **lange nicht-umbrechende Strings** ohne `word-break`/`overflow-wrap` (z.B. der neu angezeigte **Magic-Link** auf der Invite-Seite! langer Token ohne Umbruch ist ein heißer Kandidat)
- Bilder/SVG/Icons mit fester Breite > Viewport
- `position: absolute/fixed`-Elemente, die rechts rausragen
- die Wurzel-Container (`.bwza-stage`, App-Wrapper) mit `width` statt `max-width`

**Vorgehen:** Im Schritt-0-Bericht **konkret benennen**, welches Element/welche Regel den Overflow verursacht (z.B. per Durchsicht der globalen CSS + der verdächtigen Komponenten). Wenn mehrere Kandidaten → alle nennen.

### 2.2 Admin-Bereich-Struktur
- Wo ist der Admin-Einstieg (`Admin.tsx` o.ä.)? Wie sind „Mitglieder", „Drink-Katalog" etc. als **Buttons/Menü-Einträge** gebaut (Routing-Muster, eigene Routen wie `/admin/mitglieder`)?
- Wo lebt aktuell das **Invite-Formular** + die **„Ausgestellte Invites"-Liste**? (Vermutlich offen oben im Admin-Bereich statt hinter einem Button.)

---

## 3. Inhalt — zwei logische Einheiten

### Einheit 1: Horizontal-Scroll an der Wurzel beheben
- Die in 2.1 **identifizierte Ursache** gezielt beheben (das über-breite Element auf `max-width: 100%` / `width: 100%` zwingen, `100vw` vermeiden, negative Margins eindämmen, lange Strings umbrechen lassen).
- Speziell den **Magic-Link** auf der Invite-Erfolgskarte: sicherstellen, dass der lange Token-String **umbricht** (`overflow-wrap: anywhere` / `word-break: break-all`) und die Karte nicht über den Rand schiebt.
- `overflow-x: clip` + `overscroll-behavior-x: none` bleiben als Absicherung, aber die **eigentliche Overflow-Quelle** muss weg.
- **Ziel:** Seite lässt sich auf dem iPhone-PWA **nicht** mehr nach links/rechts schieben; Inhalt voll + mittig; vertikales Scrollen normal.

### Einheit 2: „Mitglied einladen" als eigene Unterseite
- Aus dem offenen Invite-Formular wird eine **eigene Unterseite mit eigener Route** (Muster wie „Mitglieder", z.B. `/admin/einladen`), erreichbar über einen **Button im Admin-Menü** (gleiches Button-Design/Reihung wie „Mitglieder", „Drink-Katalog").
- Auf dieser neuen Seite: **das Invite-Formular** + die **„Ausgestellte Invites"-Liste** zusammen (Liste zieht mit um).
- Der Admin-Einstieg zeigt „Mitglied einladen" damit **nur noch als Button**, nicht mehr als offenes Formular über den anderen Buttons.
- Zurück-Navigation (BackBar) wie auf den anderen Admin-Unterseiten.
- **Funktional unverändert:** Einladen-Logik, Magic-Link-Anzeige (kopierbar, live), Status-Chips der Invites — alles bleibt, nur verschoben/umstrukturiert.

### Bewusst NICHT
- Keine Backend-Änderung (Endpoints bleiben). Kein Schema, keine Dependency. Kein Redesign der Felder — nur Platzierung/Routing + der Overflow-Fix.

---

## 4. Done-Kriterien (Lauras Review am Handy)

- [ ] iPhone-PWA: **kein** horizontales Wischen/Verschieben mehr; Schritt-0 benennt die behobene Ursache
- [ ] Magic-Link-String bricht um, schiebt die Karte nicht über den Rand
- [ ] Admin-Menü hat **„Mitglied einladen" als Button** (wie „Mitglieder"); kein offenes Formular mehr über den Buttons
- [ ] Eigene Einladen-Unterseite mit Formular **+** „Ausgestellte Invites"-Liste; Zurück-Navigation vorhanden
- [ ] Einladen + kopierbarer Magic-Link + Status-Chips funktionieren unverändert
- [ ] `frontend build` grün, `backend test` unverändert grün; keine neue Dependency

---

## 5. Abschluss (autonom, ohne Push)

Gates grün → Code committet selbst (zwei Einheiten = ggf. zwei Commits; kein `Co-Authored-By`) → `BERICHTE/UI_FIX3_BUENDEL.md` mit echtem `git status` + `git log` + **benannter Overflow-Ursache** (vorher/nachher) + Liste der geänderten Dateien → **STOPP ohne Push.** Laura reviewt, pusht, deployt (reiner Frontend-Change → **kein** `db push`: git pull → build → restart).
