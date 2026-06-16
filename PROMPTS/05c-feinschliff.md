# B5c-Feinschliff — visuelle Iteration nach Lauras Review

**Typ:** Feinschliff-Iteration zu B5c (kein neuer Look — Korrekturen + Konsistenz). Logische Einheiten siehe §3 — **Granularität entscheidet Code selbst**.
**Autorität (Tier 5):** `design/design-tokens.css` + `design/README_DESIGN.md` (B5c-System: kühl/Teal/Glass/Inter). Zusätzlich `KONFIGURATION.md` §7.1 anpassen (3-Tab-Nav) + Änderungshistorie (Update 11).
**Voraussetzung:** B5c liegt lokal (ungepusht, ahead). **Reine Frontend-Präsentation + Nav-Struktur. Kein Schema-Change, kein `db push`, keine Logik-/Endpoint-/Datenänderung, keine neue Dependency.**
**Modus:** Voll autonom — Code committet selbst, pusht nicht. Kein `Co-Authored-By`. (Push gebündelt mit B5c durch Laura.)

---

## 1. Arbeitsmodus

Autonom, selbst committen wenn Frontend-Build + Backend-Tests grün. STOPP nur bei echtem Blocker. **Kein `git push`.** Bündel-Bericht mit echtem `git status` + `git log`. Kein `Co-Authored-By`.

---

## 2. Schritt 0 — kurz (read-only)

`git status -sb` + `git log --oneline -6` (lokal, kein `fetch`). Dann zu jedem Punkt unten die betroffene Stelle finden → `BERICHTE/B5c_FEINSCHLIFF_SCHRITT0.md` (kurz). Besonders:
- **Hintergrund-Umbruch:** woher kommt der Teal-Schimmer (`global.css`?), warum endet er bei einer bestimmten Höhe (viewport-fix statt voller Scrollhöhe?).
- **Zurück-Navigation:** wie sind Unter-Screens (Admin/Kasse/Leitung/Statistik/Mitglied-Detail/Profil) aufgebaut — gibt es einen Back-Button, scrollt er weg?
- **Bottom-Nav:** wo ist die 4-Tab-Liste definiert (`MemberLayout`/`BottomNav`).
- **ScrollList:** das B5a-Pattern.
- **Drink-Rows:** wo Emoji (`icon`) gerendert wird (Buchen + AdminDrinks) + der Emoji-Input im AdminDrinks-Formular.

---

## 3. Änderungen

### 3.1 Hintergrund durchgehend (Bug)
Der kühle Charcoal-Grund + Teal-Schimmer **bricht** mitten auf langen Screens (Laura: Verlauf-Abzeichen, Admin-Hub) — eine sichtbare horizontale Kante. Ursache: der Hintergrund deckt nur Viewport-Höhe, nicht die volle Scrollhöhe. **Root-Cause-Fix:** Hintergrund (Grund + Schimmer) **nahtlos über die gesamte Seite/Scrollhöhe**, auf allen Screens. Z.B. Hintergrund auf das durchgehende Wurzel-/Layout-Element statt auf einen viewport-hohen Container, oder ein fixes Hintergrund-Layer hinter dem scrollenden Inhalt. Keine sichtbaren Kanten mehr.

### 3.2 Sticky Zurück-Button auf Unter-Screens
Alle Nicht-Tab-Screens (Buchen, Admin-Hub + alle Admin-Unterseiten, Kasse, Leitung, Sortenstatistik, Mitglied-Detail, Profil) bekommen einen **oben fixierten/`sticky` Zurück-Button**, der **beim Scrollen sichtbar bleibt** (Teil eines schlanken Sticky-Headers, im Glass-/Token-Stil). Member-Tab-Screens (Theke/Aufladen/Verlauf) brauchen keinen — die haben die Bottom-Nav.

### 3.3 Bottom-Nav: 3 Tabs statt 4
**Buchen-Tab entfernen** → Bottom-Nav zeigt **Theke / Aufladen / Verlauf**. „Buchen" ist nur noch über den **Theke-CTA „Getränk buchen"** erreichbar (als Unter-Screen, mit Sticky-Zurück aus 3.2; Bottom-Nav bleibt sichtbar). `/buchen`-Route bleibt bestehen. `KONFIGURATION.md` §7.1 entsprechend anpassen (4→3 Tabs, Buchen als Sub-Screen) + Änderungshistorie-Eintrag (Update 11). Diff im Bündel.

### 3.4 ScrollList: Scrollbalken sichtbar + Kasten abgesetzt
Das B5a-Scroll-Pattern (Verlauf-Historie u.a.) so überarbeiten, dass der Nutzer es **als scrollbaren Kasten erkennt**:
- **Scrollbalken dauerhaft sichtbar und deutlich abgesetzt** (Custom-Scrollbar-Styling: `scrollbar-width`/`::-webkit-scrollbar` mit gut sichtbarem Thumb in Token-Farbe, nicht auto-hide).
- **Container optisch abgesetzt** (eigener Glass-/Border-Rahmen, leichte Inset-Wirkung), sodass klar ist: „hier scrollt ein Bereich innerhalb der Seite".

### 3.5 Getränke ohne Emoji → Kategorie-Farbmarker
Statt Emoji ein **kategorie-farbiger Marker** in den Drink-Rows (Buchen **und** AdminDrinks). Vorschlag-Zuordnung (Code darf für Unterscheidbarkeit feinjustieren, **dokumentieren**):
- **alkoholfrei → Blau** (`#4D8EF7`)
- **alkoholisch → Gold** (`#F4B740`)
- **sonstiges → Teal** (`#2BD4BC`)
Marker als farbiger Punkt/Chip/getönter Icon-Container (im Glass-Stil), konsistent in Buchen-Liste und Admin-Katalog. **Emoji-Input im AdminDrinks-Formular entfernen/ausblenden** (das `icon`-Feld bleibt im Modell — **kein Schema-Change** —, wird nur nicht mehr als Emoji genutzt/angezeigt). **Optional, falls schlank:** dieselbe Kategorie-Farbe in der Sortenstatistik-Liste für Konsistenz.

### Bewusst NICHT hier
- **Invite-als-Admin-Checkbox** → kommt im **Account-Block** (hat Backend-Logik).
- **Gradient-/Donut-Charts mit Chart-Lib** → separate Dependency-Entscheidung später.
- Keine Logik-/Schema-/Dependency-Änderung.

---

## 4. Done-Kriterien (Lauras Review, schmaler Viewport)

- [ ] Kein Hintergrund-Umbruch mehr — Grund/Schimmer durchgehend auf allen langen Screens
- [ ] Sticky Zurück-Button auf allen Unter-Screens, bleibt beim Scrollen sichtbar
- [ ] Bottom-Nav: 3 Tabs (Theke/Aufladen/Verlauf); Buchen via Theke-CTA; `/buchen` weiter erreichbar
- [ ] Verlauf-Historie: Scrollbalken dauerhaft sichtbar + abgesetzt, Kasten klar als scrollbar erkennbar
- [ ] Drinks ohne Emoji, stattdessen Kategorie-Farbmarker (Buchen + Admin); kein Emoji-Input mehr
- [ ] `KONFIGURATION.md` §7.1 + Update 11 angepasst (Diff im Bündel)
- [ ] Keine Funktions-/Logikänderung; `pnpm --filter backend test` grün, Frontend-`build` grün

---

## 5. Sandbox-/Test

- Kein `db push`/`db:reset`. Bei stale: `docker restart claude-bwza-getraenke` (Mac). Dev: `cd app && pnpm dev`. Test: Mac-Browser + DevTools-Mobilansicht (~390px), `localhost:3001`.

---

## 6. Abschluss (autonom, ohne Push)

Checks grün → selbst committen (Granularität dokumentiert; kein `Co-Authored-By`) → `BERICHTE/B5c_FEINSCHLIFF_BUENDEL.md` mit echtem `git status` + `git log --oneline -N` + `KONFIGURATION`-Diff + Vorher/Nachher-Stichworten je Punkt → **STOPP ohne Push.** Laura reviewt, dann Push von **B5c + Feinschliff gemeinsam** (+ Specs als chore).
