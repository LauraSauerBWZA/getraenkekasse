# Phase B5a — Struktur & Funktion (Bottom-Nav, scrollbare Listen, Berlin-Dates, Login-IDs)

**Phase:** B5a (erste Hälfte der Design-Phase; **B5b = Dark-Bar-Ästhetik** folgt separat). Logische Einheiten siehe §3 — **Commit-Granularität entscheidet Code selbst** und dokumentiert sie.
**Source of Truth:** `KONFIGURATION.md` **Update 9** — §7.1 (Bottom-Nav 4 Tabs), §7.2/§7.3 (Admin-/Leitung-Bereiche via Profil-Drawer), §12 (Login-Form-Field-IDs), §10 (Roadmap). Design: `design/README_DESIGN.md` + `design/design-tokens.css` (+ Skill `bergwacht-design`).
**Voraussetzung:** B4 abgeschlossen und gepusht. **Kein Schema-Change, kein `db push`.**
**Modus:** Voll autonom — Code committet selbst, pusht nicht. Kein `Co-Authored-By`.

> **Scope-Grenze (HART):** B5a ist **Struktur & Funktion**, nicht die Ästhetik. Bottom-Nav, Drawer, Listen-Verhalten, Datums-Logik, Form-IDs — alles mit den **bestehenden** Tokens/Primitives, funktional sauber. Die durchgängige Dark-Bar-Feinpolitur (Spacing, Typo-Feinschliff, Glow, Konsistenz über alle Screens) ist **B5b** und wird hier **nicht** vorgezogen.

---

## 1. Arbeitsmodus (volle Autonomie, steht in CLAUDE.md)

Autonom bauen, keine Echtzeit-Rückfragen, Granularität selbst wählen + dokumentieren, selbst committen wenn Tests + Typecheck + Frontend-Build grün. STOPP nur bei echtem Blocker (insb. **neue Dependency** — siehe Berlin-Dates). **Kein `git push`** (Push = Laura). Bündel-Bericht mit echtem `git status` + `git log --oneline -N`. **Kein `Co-Authored-By`.**

---

## 2. Schritt 0 — Recherche (read-only)

Session-Start: `git status -sb` + `git log --oneline -4` (lokal, kein `git fetch`). Bericht in `BERICHTE/PHASE_B5a_SCHRITT0.md` + 5–10 Zeilen. Prüfen:
1. **Aktuelle Navigation:** `App.tsx`-Routen + wie Screens heute erreicht werden (Dashboard-Cards). Welche Member-Screens existieren (Theke/Dashboard, Buchen, Aufladen, Verlauf) und welche Admin-/Leitung-Einstiege (Karten auf Dashboard/Admin).
2. **Gibt es schon Ansätze** für BottomNav/ProfileDrawer/Avatar in `components/`/`primitives`? (§8 nennt sie als Primitives.)
3. **Wachsende Listen** auflisten: Kassen-Historie (AdminKasse), Mitglied-Detail-Historie (AdminMitgliedDetail), Trinkjournal-Historie (Verlauf), Aufladungs-Anfragen, Invite-Liste, Sortenstatistik — Kandidaten für das einheitliche Scroll-Pattern.
4. **Journal-Datums-Logik** (`routes/journal.ts`, B4): aktuell UTC (`toISOString().slice(0,10)`). Umstellpunkt auf Europe/Berlin.
5. **Login/SetPassword-Formfelder** (`routes/Login.tsx` etc.): fehlende `id`/`name`/`autocomplete`.
6. **Rollen-Infos aus `/me`** (`isAdmin`, `isLeitung`) fürs Drawer-Menü.

Kein `db push`, kein Blocker erwartet. **Falls Berlin-Dates eine neue Dependency bräuchten → STOPP** (siehe §3).

---

## 3. Inhalt

### Bottom-Nav + Profil-Drawer (Navigations-Umbau, §7.1–7.3)

- **Persistente Bottom-Nav** für Mitglieder mit **4 Tabs:** 🏠 Theke · 🍺 Buchen · 💳 Aufladen · 🕒 Verlauf. Aktiver Tab markiert. Auf allen Member-Screens sichtbar.
- **Dashboard wird zur „Theke"** (Guthaben groß + Quick-Buchung-CTA, §7.1) — es ist **kein Navigations-Hub** mehr; die Wege zu Buchen/Aufladen/Verlauf laufen über die Bottom-Nav.
- **Profil-Drawer** (Avatar-Tap im Header): rollenabhängige Einträge —
  - immer: **Profil**, **Logout**
  - wenn `isAdmin`: Einstieg in den **Admin-Bereich** (Mitglieder, Einladen, Drinks, Aufladungs-Anfragen, Sortenstatistik, Kasse, eigenes paypal.me-Profil)
  - wenn `isLeitung`: Einstieg in die **Leitung-Kassen-Einsicht** + Sortenstatistik
- Die bisherigen Dashboard-/Admin-Karten als Navigationsmittel werden durch Bottom-Nav + Drawer ersetzt (Routen bleiben erhalten, nur die Einstiege wandern). Bestehende Routen dürfen **nicht** brechen.
- Funktional + mit bestehenden Tokens; **kein** Ästhetik-Feinschliff (B5b).

### Einheitliche scrollbare Listen

- **Ein geteiltes Pattern/Komponente** für alle wachsenden Listen: feste Maximalhöhe mit **internem Scroll**, neueste zuerst — die Seite wächst nicht mehr unbegrenzt. Anwenden auf: Kassen-Historie, Mitglied-Detail-Historie, Trinkjournal-Historie, Aufladungs-Anfragen, Invite-Liste, Sortenstatistik (wo sinnvoll).
- **Bei ~30 Mitgliedern reicht ein Frontend-Scroll-Container** (alle Einträge rendern, in fester Höhe scrollen) — **keine Backend-Paginierung nötig**. Falls eine Liste extrem lang würde, optional „mehr anzeigen"-Limit, aber nicht Pflicht. Einheitlich halten, Wahl dokumentieren.

### Berlin-Tagesgrenzen (Journal-Backend)

- Journal-Tagesbuckets (Hero-Monat, „diese Woche", Streak, längste Pause, 30-Tage-Verlauf) auf **Europe/Berlin** statt UTC.
- **Dependency-frei** via `Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' })` (o.ä.) für den lokalen Tages-String — **keine** neue Date-Lib. DST (CET/CEST) wird durch `Intl` korrekt behandelt.
- **Falls Code eine neue Dependency für nötig hält → STOPP** (Blocker, Laura fragen).
- Tests entsprechend auf Berlin-Tagesgrenzen anpassen (synthetische Daten, inkl. eines Falls nahe Mitternacht).

### Login-Form-Field-IDs (§12)

- Login- (und ggf. SetPassword-) Formfelder mit sauberen `id`/`name`/`autocomplete` (`email`, `current-password`/`new-password`) versehen → DevTools-Autofill-Warnung weg, bessere Passwort-Manager-Integration.

### Bewusst NICHT in B5a

- **Dark-Bar-Ästhetik / Spacing-/Typo-Feinschliff / Glow / Screen-für-Screen-Konsistenz** — **B5b**.
- **PWA / Sound / letzter Schliff** — **B6**.
- **Backend-Paginierung** (nicht nötig bei 30 Mitgliedern).
- **Kein Schema-Change.**

---

## 4. Done-Kriterien (Lauras async Review)

- [ ] Persistente **Bottom-Nav** mit 4 Tabs (Theke/Buchen/Aufladen/Verlauf), aktiver Zustand sichtbar, auf allen Member-Screens
- [ ] **Profil-Drawer** (Avatar): Profil + Logout immer; Admin-Einstieg nur bei `isAdmin`; Leitung-Einsicht nur bei `isLeitung`
- [ ] Bestehende Routen funktionieren unverändert (nichts gebrochen)
- [ ] **Wachsende Listen scrollen** in fester Höhe (einheitlich) — Seite wird nicht mehr unbegrenzt lang
- [ ] Journal-Tageslogik in **Europe/Berlin** (Tests angepasst, inkl. Mitternachts-Fall)
- [ ] Login-Formfelder mit `id`/`name`/`autocomplete` — keine DevTools-Warnung
- [ ] `pnpm --filter backend test` grün, Frontend-`build` grün

---

## 5. Sandbox-/Test-Hinweise

- Kein `db push`, kein `db:reset` (kaputt). Bei hängendem Prozess `docker restart claude-bwza-getraenke` (vom Mac). Dev: `cd app && pnpm dev`.
- **Browser-Test:** zwischen allen 4 Tabs navigieren (aktiver Zustand). Avatar → Drawer: als Admin alle Einstiege, als normales Mitglied nur Profil/Logout, als Leitung zusätzlich die Kassen-Einsicht. Eine lange Liste (z.B. Kassen-Historie nach mehreren Buchungen) scrollt **innerhalb ihrer Box**, statt die Seite zu strecken. Login-Seite: Browser-Konsole ohne Autofill-Warnung. (Berlin-Tagesgrenzen: wie bei B4 v.a. über Tests abgesichert.)

---

## 6. Abschluss (autonom, ohne Push)

Tests/Typecheck/Frontend-Build grün → Code committet selbst (Granularität dokumentiert; kein `Co-Authored-By`) → `BERICHTE/PHASE_B5a_BUENDEL.md` mit echtem `git status` + `git log --oneline -N` + Browser-Test-Anleitung → **STOPP ohne Push.** Laura reviewt, testet, pusht.
