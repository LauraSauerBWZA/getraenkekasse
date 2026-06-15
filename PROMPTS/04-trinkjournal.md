# Phase B4 — Trinkjournal + Achievements + 30-Tage-Verlauf (privat, pro User)

**Phase:** B4. Logische Einheiten siehe §3 — **Commit-Granularität entscheidet Code selbst** und dokumentiert sie.
**Source of Truth:** `KONFIGURATION.md` **Update 9** — §4 (Mitglied: privates Trinkjournal + eigene Historie), §7.1 (🕒 Verlauf-Tab), §7.4 (Trinkjournal & Achievements), §9/§11 (sortenagnostisch, kein Lieblings-Drink), §10 (Roadmap). Design: `design/README_DESIGN.md` + `design/design-tokens.css` (Fraunces, Amber).
**Voraussetzung:** B3 abgeschlossen und gepusht. **Kein Schema-Change, kein `db push`** (rechnet auf bestehenden `Transaktion` + `Drink`; Achievements werden **live abgeleitet**, keine Persistenz).
**Modus:** Voll autonom — Code committet selbst, pusht nicht. Kein `Co-Authored-By`.

---

## 1. Arbeitsmodus (volle Autonomie, steht in CLAUDE.md)

Autonom bauen, keine Echtzeit-Rückfragen, Granularität selbst wählen + dokumentieren, selbst committen wenn Tests + Typecheck + Frontend-Build grün. STOPP nur bei echtem Blocker. **Kein `git push`** (Push = Laura). Bündel-Bericht mit echtem `git status` + `git log --oneline -N`. **Kein `Co-Authored-By`.**

---

## 2. Schritt 0 — Recherche (read-only)

Session-Start: `git status -sb` + `git log --oneline -4` (lokal, kein `git fetch`). Bericht in `BERICHTE/PHASE_B4_SCHRITT0.md` + 5–10 Zeilen. Prüfen:
1. **Zustand des 🕒 Verlauf-Tabs:** existiert eine **eigene Transaktions-Historie** des Mitglieds schon (Route/Endpoint), oder ist der Tab ein Stub? → Scope: fehlende Teile in B4 ergänzen.
2. **Datenquelle:** eigene `Transaktion` (`typ=KAUF/AUFLADUNG_*/KORREKTUR/STORNO`, `createdAt`, `drinkId`, `betragCent`).
3. **Storno-Erkennung** (B2g/B3-Muster): KAUF mit verweisendem `STORNO` gilt als storniert.
4. **Live-Guthaben** (`computeGuthabenCent`, B2c) für den Hamster-Check / Verlauf.
5. **Design-Tokens/Primitives** (`design/`): Fraunces für die Hero-Zahl, Amber-Töne (`Amber-Deep`/`Amber-Light`) für den 30-Tage-Verlauf, vorhandene `StatCard`/`Glass`/`EmptyState`.
6. **Auth-Kontext** Frontend (`/me`, `useAuth`) — der Tab nutzt die eigene Identität, **nie** eine fremde User-ID.

Kein `db push`, kein Blocker erwartet → durchbauen.

---

## 3. Inhalt

### Grundprinzip (HART): privat + sortenagnostisch

- **Strikt eigene Daten:** alle Journal-Endpoints nutzen `req.auth.sub`, **niemals** ein `:userId`-Param. Kein Admin-/Leitung-Zugriff auf fremde Journale (§7.4 „auch vor Leitung").
- **Sortenagnostische Statistik:** Hero, Stat-Strip, 30-Tage-Verlauf, Achievements rechnen mit **Anzahl/Beträgen**, **nicht** pro Drink — kein „Lieblings-Drink", keine Pro-Sorten-Auswertung im Journal (§9/§11).
- **Ausnahme Historie-Liste:** die eigene Transaktions-Liste **darf** pro Buchung den Drink-Namen zeigen (eigene Daten, Transparenz — konsistent mit DSGVO-Datenexport §9). Nur die **aggregierten Journal-Stats** sind sortenagnostisch.
- **Stornierte Käufe** zählen **nicht** in die Journal-Stats (konsistent mit B3).

### Backend — Journal-Stats (eigene)

`GET /journal` (o.ä.), `requireAuth`, eigene Daten:
- **Hero:** Anzahl eigener gültiger Käufe **im aktuellen Kalendermonat** („X Getränke diesen Monat").
- **Stat-Strip:**
  - *Diese Woche* = Anzahl Käufe in der laufenden Woche
  - *Streak* = Tage in Folge (bis heute) mit ≥1 Buchung
  - *Längste Pause* = längste Folge von Tagen **ohne** Buchung (neutral, kein Wertungs-Coach)
- **30-Tage-Verlauf:** Array der letzten 30 Tage mit `{ datum, anzahl, istWochenende }` (Wochenenden für die Amber-Deep-Färbung markiert).
- **Achievements** (live abgeleitet, mit `freigeschaltet`-Flag, ggf. Fortschritt):
  - 🏔️ Erstbesteigung — erstes Getränk gebucht
  - 🌧️ Trockenwoche — 7 Tage in Folge keine Buchung
  - ⛺ Hüttenabend — 3 Getränke an einem Tag
  - 🎒 Tourenrucksack — 20 Getränke in einem Kalendermonat
  - 🪙 Hamster — Guthaben erstmals über 50 € (Interpretation wählen + dokumentieren, z.B. Guthaben-Stand hat 50 € überschritten)
  - 🎖️ Stammgast — 100 Buchungen gesamt
  - 🧗 Seilschaft — **Future** (es gibt keinen „Runde ausgeben"-Mechanismus): als **gesperrt/coming-soon** anzeigen oder weglassen, **nicht** freischaltbar
- **Tag-Detail** für den Balken-Tap: entweder im 30-Tage-Payload mitliefern, oder eigener `GET /journal/tag/:datum`, oder über die Historie-Liste filtern (Code-Entscheidung).
- Tests: Streak/Längste-Pause mit synthetischen Datumswerten; Monats-/Wochenzählung; **stornierte Käufe ausgeschlossen**; Achievement-Schwellen (genau an der Grenze); Antwort ist **eigene** Daten (anderer User → nur seine eigenen).

### Backend — eigene Transaktions-Historie (falls noch nicht vorhanden)

`GET /me/transaktionen` (o.ä.), `requireAuth`, eigene Daten, chronologisch absteigend: Typ, Betrag (Vorzeichen), Drink-Name bei KAUF, Notiz, Zeit, storniert-Flag. (Falls in einer früheren Phase schon gebaut → wiederverwenden, nicht doppeln.)

### Frontend — 🕒 Verlauf-Tab

- **Journal-Sektion (oben):**
  - **Hero:** große Monatszahl in **Fraunces**, Amber-Glow-Card.
  - **Stat-Strip:** 3 Cards (Diese Woche / Streak / Längste Pause), neutral formuliert.
  - **30-Tage-Verlauf:** Balkendiagramm, **Wochenenden Amber-Deep, Wochentage Amber-Light**, Tap auf einen Balken → Buchungen dieses Tages. Schlicht (kein schweres Chart-Lib nötig — Politur ist B5).
  - **Achievements:** Grid, freigeschaltete hervorgehoben, gesperrte dezent; locker/selbstironisch, **niemals wertend** Richtung „trink mehr/weniger".
- **Historie-Liste (darunter):** eigene Transaktionen chronologisch — Aufladungen mit grünem `+`, Buchungen mit dezentem `−`, Drink-Name bei Käufen, stornierte ausgegraut. Footer: „Du bist seit *N Tagen* dabei."
- Empty-States, wo nötig (noch keine Buchung etc.).
- `lib/api.ts`: `journal()`, ggf. `meineTransaktionen()`.

### Bewusst NICHT in B4

- **Kein** Drink-bezogenes „dein Lieblingsgetränk" o.ä. im Journal (sortenagnostisch, HART).
- **Seilschaft** nicht freischaltbar (kein Runden-Mechanismus) — Future.
- **Design-Feinpolitur / scrollbare/paginiierte Listen / Sound** — **B5/B6**.
- **Kein Schema-Change.**

---

## 4. Done-Kriterien (Lauras async Review)

- [ ] 🕒 Verlauf zeigt Hero-Monatszahl, Stat-Strip (Woche/Streak/Längste Pause), 30-Tage-Balken (Wochenende/Wochentag farblich), Achievements
- [ ] Tap auf einen Balken → Buchungen dieses Tages
- [ ] Eigene Transaktions-Historie (Aufladung `+`, Buchung `−`, Drink bei Kauf, „seit N Tagen dabei")
- [ ] **Privat:** nur eigene Daten; **kein** Admin-/Leitung-Zugriff auf fremde Journale; Journal-Endpoints ohne `:userId`
- [ ] Journal-Stats **sortenagnostisch** (Anzahl/Beträge), nur die Historie-Liste zeigt Drinks
- [ ] Stornierte Käufe zählen nicht in die Stats
- [ ] `pnpm --filter backend test` grün, Frontend-`build` grün

---

## 5. Sandbox-/Test-Hinweise

- Kein `db push`, kein `db:reset` (kaputt). Bei hängendem Prozess `docker restart claude-bwza-getraenke` (vom Mac). Dev: `cd app && pnpm dev`.
- **Browser-Test-Grenze:** Streak/Längste-Pause/30-Tage-Verlauf hängen an **mehreren Tagen** — in einer einzigen Session liegen alle Buchungen auf „heute" (Streak 1, ein Balken). Die **Datums-Logik ist über die Tests abgesichert** (synthetische Daten); manuell sind v.a. Hero-Zahl, Achievements (Erstbesteigung/Hüttenabend/Stammgast über mehrere Buchungen heute), Historie-Liste und der allgemeine Aufbau prüfbar. Im Bündel-Bericht klar sagen, was manuell sichtbar ist und was die Tests abdecken.

---

## 6. Abschluss (autonom, ohne Push)

Tests/Typecheck/Frontend-Build grün → Code committet selbst (Granularität dokumentiert; kein `Co-Authored-By`) → `BERICHTE/PHASE_B4_BUENDEL.md` mit echtem `git status` + `git log --oneline -N` + Browser-Test-Anleitung (inkl. der Mehrtage-Grenze) → **STOPP ohne Push.** Laura reviewt, testet, pusht.
