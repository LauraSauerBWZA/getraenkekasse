# Phase B5b — Dark-Bar-Ästhetik (durchgängiger optischer Feinschliff)

**Phase:** B5b (zweite Hälfte der Design-Phase; B5a = Struktur/Funktion ist durch). Logische Einheiten siehe §3 — **Commit-Granularität entscheidet Code selbst** und dokumentiert sie.
**Autorität (Tier 5):** das **App-eigene** Design-System — `design/README_DESIGN.md` + `design/design-tokens.css`. Das ist die bewusst gewählte **dunkle Berghütten-Bar-Ästhetik** (Update 2, „Dark-Bar statt Warm-Creme"), `--bwza-*`-OKLCH-Tokens, Fonts Fraunces (Display) / Inter (UI) / JetBrains Mono (Zahlen), Glass-Komponenten, Amber-Akzente. Referenz: `KONFIGURATION.md` §8.
**Voraussetzung:** B5a abgeschlossen und gepusht. **Kein Schema-Change, kein `db push`. Reine Frontend-Präsentation.**
**Modus:** Voll autonom — Code committet selbst, pusht nicht. Kein `Co-Authored-By`.

> **HART — was B5b NICHT ist:**
> - **Kein** neuer Look, **keine** neue Designsprache. Strikt an den vorhandenen Tokens ausrichten.
> - **Nicht** die offizielle DRK-Bergwacht-Corporate-Identity (Skill `bergwacht-design`) über die Dark-Bar-Tokens ziehen — die App hat bewusst ihren eigenen Look. Den `bergwacht-design`-Skill höchstens als Referenz für Logo/Wortmarke, **nicht** für Farben/Hintergründe.
> - **Keine** Funktions-/Logik-/Endpoint-/Datenänderung. Wenn ein Screen für ein Layout eine kleine strukturelle Anpassung braucht, ok — aber **kein** Verhalten ändern.
> - **Keine** neue Dependency (vorhandenes nutzen; Framer Motion ist im Stack, falls Animation gewünscht).

---

## 1. Arbeitsmodus (volle Autonomie, steht in CLAUDE.md)

Autonom bauen, keine Echtzeit-Rückfragen, Granularität selbst wählen + dokumentieren, selbst committen wenn Tests + Typecheck + Frontend-Build grün. STOPP nur bei echtem Blocker (insb. neue Dependency). **Kein `git push`** (Push = Laura). Bündel-Bericht mit echtem `git status` + `git log --oneline -N`. **Kein `Co-Authored-By`.**

---

## 2. Schritt 0 — Design-Audit (read-only)

Session-Start: `git status -sb` + `git log --oneline -4` (lokal, kein `git fetch`). **Design-System gründlich lesen:** `design/README_DESIGN.md` + `design/design-tokens.css` (welche Tokens, Fonts, Glass-Regeln, Amber-Töne gibt es wirklich). Dann **Audit aller Screens** → `BERICHTE/PHASE_B5b_SCHRITT0.md` + 5–10 Zeilen Chat. Pro Screen kurz festhalten:
- Wo werden **hartkodierte** Farben/Größen/Abstände statt Tokens verwendet?
- Inkonsistente **Cards / Buttons / Inputs / Sheets / List-Rows / Empty-States / Loading**?
- **Typo:** wird Fraunces für Display/Hero, Inter für UI, JetBrains Mono für Beträge konsequent genutzt?
- **Amber/Glow** konsistent (CTAs, aktive Zustände, Hero)? Negativ-Rot / Success-Grün einheitlich?
- Welche **§8-Primitives** existieren nur inline und sollten konsolidiert werden (StatCard, Flash, EmptyState, Skeleton, DrinkPicker, DrinkConfirm, DrinkCatalogRow, AufladungsAnfrageRow, MitgliederSaldoRow, KassenBestandCard, KassenTransaktionRow, EinkaufSheet, AdminBanner, ProfileDrawer)?

Das Audit ist der **Polish-Plan**. Kein `db push`, kein Blocker erwartet → danach umsetzen.

---

## 3. Inhalt — konservativer Konsistenz-Durchgang

Ziel: jeder Screen fühlt sich als Teil **desselben** Dark-Bar-Systems an. Pro Bereich:

### Geteilte Primitives zuerst
- Token-getriebene, wiederverwendbare Bausteine konsolidieren: **Card/Glass**, **GlassButton**-Varianten (primär/sekundär/destruktiv), **Input/Sheet**, **List-Row**, **StatCard**, **Chip/Badge** (Status), **EmptyState**, **Loading/Skeleton**. Inline-Duplikate auf diese Bausteine ziehen.
- Globale Basis: Hintergrund/Surface/Text-Kontraste, Fokus-Ringe, Tap-Targets (≥44px), konsistente Radius/Spacing-Skala aus den Tokens.

### Member-Bereich
- **Theke** (Guthaben-Hero in Fraunces, Quick-Buchung-CTA in Amber), **Buchen** (DrinkPicker/Kategorien, DrinkConfirm-Sheet), **Aufladen** (Beträge, zuständiger-Verwalter-Hinweis, Bargeld-Card), **Verlauf** (Journal-Hero, Stat-Strip, 30-Tage-Balken in Amber-Deep/Amber-Light, Achievement-Grid, Historie-Rows), **Bottom-Nav** + **Profil-Drawer** Feinschliff (aktive Zustände, Spacing, Safe-Area).

### Admin-Bereich
- Mitglieder-Liste/-Detail, Drink-Katalog, Einladen, Aufladungs-Anfragen, eigenes paypal.me-Profil — einheitliche Cards/Rows/Sheets, negative Salden konsistent rot, Pflicht-Notiz-Felder einheitlich.

### Kasse / Leitung / Statistik
- Kassen-Screen (Vermögen-Hero, Töpfe-Liste, Deckungs-Card rot bei negativ, Aktions-Sheets, Historie), Leitung-Read-only-Ansicht, Sortenstatistik (Zeitfilter, Drink-Rows, relative Balken) — gleiche Sprache wie der Rest.

### Querschnitt
- Konsistente **Fehlermeldungen/Flash**, **Empty-States** mit freundlichem Ton, **Loading-Skeletons** statt Sprünge, sinnvolle **Transitions** (dezent, mit vorhandenem Framer Motion). Mobile-first, gut auf schmalen Viewports.

---

## 4. Done-Kriterien (Lauras async Review — visuell, danach Iteration)

- [ ] Alle Screens nutzen die `--bwza-*`-Tokens statt hartkodierter Werte; **keine** Fremdfarben/-fonts
- [ ] Cards/Buttons/Inputs/Sheets/List-Rows/Empty/Loading **konsistent** über alle Bereiche
- [ ] Typo konsequent: Fraunces (Display/Hero), Inter (UI), JetBrains Mono (Beträge)
- [ ] Amber-Akzente/Glow, Negativ-Rot, Success-Grün einheitlich
- [ ] Mobile-first sauber (Tap-Targets, Safe-Area über der Bottom-Nav, Kontrast)
- [ ] **Keine** Funktions-/Logikänderung; `pnpm --filter backend test` grün, Frontend-`build` grün
- [ ] (Erwartet: danach eine gezielte Feinschliff-Runde nach Lauras Blick aufs Handy)

---

## 5. Sandbox-/Test-Hinweise

- Kein `db push`, kein `db:reset` (kaputt). Bei hängendem Prozess `docker restart claude-bwza-getraenke` (vom Mac). Dev: `cd app && pnpm dev`.
- **Browser-Test:** alle Screens auf **schmaler (Handy-)Viewport-Breite** durchgehen — Theke/Buchen/Aufladen/Verlauf, dann via Drawer Admin/Kasse/Leitung/Statistik. Auf Konsistenz achten (gleiche Cards/Abstände/Typo), keine abgeschnittenen Inhalte hinter der Bottom-Nav, lesbare Kontraste. Im Bündel-Bericht eine **Screen-Liste mit dem jeweiligen Vorher/Nachher in Stichworten**, damit Laura gezielt gegenchecken kann.

---

## 6. Abschluss (autonom, ohne Push)

Tests/Typecheck/Frontend-Build grün → Code committet selbst (Granularität dokumentiert; kein `Co-Authored-By`) → `BERICHTE/PHASE_B5b_BUENDEL.md` mit echtem `git status` + `git log --oneline -N` + Screen-für-Screen-Stichworten + Browser-Test-Anleitung → **STOPP ohne Push.** Laura reviewt visuell, testet, pusht — danach voraussichtlich eine kleine Feinschliff-Iteration.
