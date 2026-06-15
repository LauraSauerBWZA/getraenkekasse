# Phase B3 — Sortenstatistik (Admin + Leitung, anonym aggregiert)

**Phase:** B3. Logische Einheiten siehe §3 — **Commit-Granularität entscheidet Code selbst** und dokumentiert sie.
**Source of Truth:** `KONFIGURATION.md` **Update 9** — §4 (Admin/Leitung sehen Sortenstatistik), §7.5 (Sortenstatistik), §9 (DSGVO — anonym, kein User-Bezug), §11 (kein Lieblings-Drink, keine Top-Konsumenten), §10 (Roadmap).
**Voraussetzung:** Phase B2 vollständig abgeschlossen und gepusht. `requireAdminOrLeitung` existiert (B2j). **Kein Schema-Change, kein `db push`** (rechnet auf bestehenden `Transaktion` + `Drink`).
**Modus:** Voll autonom — Code committet selbst, pusht nicht. Kein `Co-Authored-By`.

---

## 1. Arbeitsmodus (volle Autonomie, steht in CLAUDE.md)

Autonom bauen, keine Echtzeit-Rückfragen, Granularität selbst wählen + dokumentieren, selbst committen wenn Tests + Typecheck + Frontend-Build grün. STOPP nur bei echtem Blocker. **Kein `git push`** (Push = Laura). Bündel-Bericht mit echtem `git status` + `git log --oneline -N`. **Kein `Co-Authored-By`.**

---

## 2. Schritt 0 — Recherche (read-only)

Session-Start: `git status -sb` + `git log --oneline -4` (lokal, kein `git fetch`). Bericht in `BERICHTE/PHASE_B3_SCHRITT0.md` + 5–10 Zeilen. Prüfen:
1. **`Transaktion`** (B2c): `typ=KAUF` mit `drinkId` + `preisAtKaufCent` + `createdAt`. Das ist die Datenquelle.
2. **Storno-Erkennung** (B2g `GET /admin/users/:id` macht das schon): ein `KAUF` gilt als storniert, wenn eine `STORNO`-Transaktion mit `stornoVonId` darauf verweist. → Muster wiederverwenden, um stornierte Käufe **auszuschließen**.
3. **`requireAdminOrLeitung`** (B2j) — als Guard für den read-only Statistik-Endpoint wiederverwenden.
4. **Drink-Stammdaten** (`name`, `icon`, `kategorie`) für die Anzeige.
5. **Frontend-Einstiege:** Admin-Bereich (`Admin.tsx`-Cards) **und** Leitung-Bereich (`LeitungKasse.tsx`/`/leitung` aus B2j) — beide brauchen einen Einstieg zur Statistik.

Kein `db push`, kein Blocker erwartet → durchbauen.

---

## 3. Inhalt

### Backend — Aggregations-Endpoint

- `GET /statistik/sorten` (o.ä.), **`requireAdminOrLeitung`** (Admin **und** Leitung lesen).
- **Zeitfilter** per Query-Param: `woche` / `monat` / `quartal` (rollierende Fenster: letzte 7 / 30 / 90 Tage — Default dokumentieren). Filtert auf `Transaktion.createdAt`.
- **Aggregation pro Drink** über `typ=KAUF` im Fenster, **stornierte Käufe ausgeschlossen** (kein verweisender `STORNO`):
  - `anzahl` = Anzahl gültiger Käufe
  - `umsatzCent` = Summe `preisAtKaufCent` der gültigen Käufe (eingefrorener Preis, nicht der aktuelle Drink-Preis)
- Rückgabe pro Drink: `drinkId`, `name`, `icon`, `kategorie`, `anzahl`, `umsatzCent`; sinnvoll sortiert (z.B. `anzahl` absteigend). Optional Gesamt-Summen (Käufe gesamt, Umsatz gesamt).
- **DSGVO (HART, §9/§11):** rein **app-weit aggregiert**, **kein** `userId` in der Abfrage oder Antwort, **keine** Gruppierung nach User, **keine** Top-Konsumenten. Nur Drink-Totale.
- Drinks ohne Käufe im Fenster: weglassen **oder** mit 0 zeigen (Code-Entscheidung, dokumentieren).
- Tests: korrekte Anzahl/Umsatz pro Drink; **stornierte Käufe zählen nicht**; eingefrorener `preisAtKaufCent` (nicht aktueller Preis); Zeitfilter grenzt korrekt ab; **Leitung darf lesen (200)**, normales Mitglied → 403; Antwort enthält keinerlei User-Feld.

### Frontend — Statistik-Screen

- Read-only Screen: Zeitfilter-Umschalter (Woche / Monat / Quartal), darunter pro Drink eine Zeile mit Icon, Name, Kategorie, **Anzahl** und **Umsatz**. Optional eine schlichte relative Balkenlänge je Drink (kein aufwändiges Chart — Politur ist B5).
- **Einstieg an zwei Stellen:** Admin-Bereich (`Admin.tsx`-Card „📊 Sortenstatistik") **und** Leitung-Bereich (Karte/Link in der Leitung-Ansicht). Gleicher Screen, gleicher Endpoint.
- Empty-State, wenn im Fenster keine Käufe vorliegen.
- `lib/api.ts`: `sortenStatistik(zeitraum)`.

### Bewusst NICHT in B3

- **Persönliches Trinkjournal / Achievements / 30-Tage-Verlauf** — das ist **B4** (privat, pro User, sortenagnostisch — strikt getrennt von dieser anonymen App-Statistik).
- **Design-Politur / aufwändige Charts / scrollbare Listen** — **B5**.
- **Kein Schema-Change.**

---

## 4. Done-Kriterien (Lauras async Review)

- [ ] Admin **und** Leitung können die Sortenstatistik öffnen (gleicher Screen)
- [ ] Zeitfilter Woche / Monat / Quartal wirkt
- [ ] Pro Drink: Anzahl + Umsatz, korrekt aggregiert, **stornierte Käufe nicht enthalten**
- [ ] **Anonym:** nirgends ein User-Bezug, keine Top-Konsumenten
- [ ] Normales Mitglied kommt **nicht** an die Statistik (403, kein UI)
- [ ] `pnpm --filter backend test` grün, Frontend-`build` grün

---

## 5. Sandbox-/Test-Hinweise

- Kein `db push`, kein `db:reset` (kaputt). Bei hängendem Prozess `docker restart claude-bwza-getraenke` (vom Mac). Dev: `cd app && pnpm dev`.
- **Browser-Test:** als Mitglied ein paar Getränke buchen → als Admin die Statistik prüfen (Anzahl/Umsatz stimmen, Zeitfilter umschalten). **Eine** Buchung stornieren → fällt aus der Statistik. Als Leitung-Mitglied (B2j) gegenchecken, dass die Statistik dort ebenfalls sichtbar ist.

---

## 6. Abschluss (autonom, ohne Push)

Tests/Typecheck/Frontend-Build grün → Code committet selbst (Granularität dokumentiert; kein `Co-Authored-By`) → `BERICHTE/PHASE_B3_BUENDEL.md` mit echtem `git status` + `git log --oneline -N` + Browser-Test-Anleitung → **STOPP ohne Push.** Laura reviewt, testet, pusht.
