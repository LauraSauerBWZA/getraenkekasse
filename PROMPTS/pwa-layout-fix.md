# PWA-Layout-Fix — Safe-Area (Statusleiste) + Zentrierung / kein Horizontal-Scroll

**Typ:** Frontend-CSS-Fix für die installierte PWA (zwei reale Bugs auf dem Handy-Homescreen). Logische Einheiten siehe §3 — **Granularität entscheidet Code selbst**.
**Source of Truth:** `design/design-tokens.css` + B5c/Feinschliff-Layout (Tier 5). **Kein** Schema-Change, **keine** neue Dependency, **keine** Backend-/Logik-Änderung.
**Voraussetzung:** App ist live (B8); PWA installierbar (B6, `viewport-fit=cover` ist im index.html bereits gesetzt).
**Modus:** Voll autonom — Code committet selbst, pusht nicht. Kein `Co-Authored-By`.

> **Kontext (Lauras Befund auf dem installierten Homescreen-PWA, iOS):**
> 1. **Zurück-Button + Profil-Button sitzen zu weit oben** — liegen hinter Uhr/Empfang/Akku (Statusleiste). Im Standalone-Modus muss man ins Querformat wechseln, um sie zu treffen. → Safe-Area oben wird nicht respektiert.
> 2. **App sitzt nicht mittig / lässt sich horizontal verschieben** (Scroll nach links/rechts). → Irgendwo Horizontal-Overflow; Inhalt soll auf volle Breite begrenzt + zentriert sein, kein X-Scroll.

---

## 1. Arbeitsmodus

Autonom, selbst committen wenn Frontend-Build grün + Backend-Tests unverändert grün. STOPP nur bei echtem Blocker. **Kein `git push`.** Bündel mit echtem `git status` + `git log`. Kein `Co-Authored-By`.

---

## 2. Schritt 0 — Recherche (read-only)

`git status -sb` + `git log --oneline -4` (lokal, kein `fetch`). Bericht → `BERICHTE/PWA_LAYOUT_SCHRITT0.md` + 5–10 Zeilen. Klären:
1. **`index.html`**: `viewport`-Meta — ist `viewport-fit=cover` gesetzt? (sollte seit B6) — Voraussetzung, damit `env(safe-area-inset-*)` überhaupt Werte liefert.
2. **Obere Sticky-Leiste(n)**: die Komponente(n) mit Zurück- + Profil-Button — `MemberLayout.tsx` (Header sticky, Profil-Avatar) und die `BackBar.tsx` (sticky Zurück auf Unter-Screens, aus B5c-Feinschliff). Wo wird `top`/`padding`/`height` gesetzt?
3. **Horizontal-Overflow-Quelle**: welches Element ist breiter als der Viewport? (z.B. ein Container ohne `max-width`/`box-sizing`, ein zu breites Element, negatives Margin, `100vw` statt `100%`, eine Tabelle/ScrollList). `styles/global.css` + die Layout-Wrapper prüfen.
4. **App-Wrapper/Zentrierung**: gibt es einen zentralen Content-Container (`max-width` + `mx-auto`)? Bottom-Nav: respektiert sie `env(safe-area-inset-bottom)` (iPhone-Home-Indicator)?

---

## 3. Inhalt

### 3.1 Safe-Area oben (Statusleiste)
Die **oberen Sticky-Leisten** (MemberLayout-Header **und** `BackBar`) so anpassen, dass sie die iOS-Statusleiste **nicht** überlappen: oben `env(safe-area-inset-top)` als zusätzliches Padding (z.B. `padding-top: calc(<bisher> + env(safe-area-inset-top))`), sodass Zurück- + Profil-Button **unterhalb** von Uhr/Akku liegen. Im Browser/Desktop (wo das Inset 0 ist) ändert sich nichts.

### 3.2 Kein Horizontal-Scroll + Zentrierung
- Horizontal-Overflow **eliminieren**: die Quelle aus Schritt 0 beheben (z.B. `overflow-x: hidden` am Wurzel-Wrapper **plus** die eigentliche Ursache fixen — `100vw`→`100%`, `box-sizing: border-box`, Breiten begrenzen). Ziel: **kein** Verschieben nach links/rechts mehr.
- **Zentrierung**: Content-Wrapper mittig (`margin-inline: auto`), auf Handy **volle Breite** (keine seitliche Leere, aber auch kein Überlauf). Auf breiten Screens darf eine sinnvolle `max-width` bleiben — Hauptsache mobil full-width + zentriert, kein X-Scroll.

### 3.3 Safe-Area seitlich + unten (mitnehmen, da man eh dran ist)
- Bottom-Nav: `env(safe-area-inset-bottom)` berücksichtigen (Home-Indicator).
- Seitliche Insets (`safe-area-inset-left/right`) für Querformat/Notch, falls relevant.

### Bewusst NICHT
- Kein Redesign, keine Farb-/Font-Änderung, keine neue Komponente außer nötigen CSS-Anpassungen.
- Keine Backend-/Schema-/Dependency-Änderung.

---

## 4. Done-Kriterien (Lauras Review — am echten Homescreen-PWA)

- [ ] Zurück- + Profil-Button liegen **unter** der Statusleiste, im Hochformat antippbar (kein Querformat-Trick mehr nötig)
- [ ] **Kein** horizontaler Scroll mehr; App sitzt zentriert, auf dem Handy volle Breite
- [ ] Bottom-Nav nicht hinter dem Home-Indicator
- [ ] Desktop/Browser-Ansicht unverändert (Insets = 0 → keine Regression)
- [ ] Frontend-`build` grün, Backend-Tests unverändert (201); kein Schema-Change, keine neue Dependency

---

## 5. Test-Hinweise

- **Im Sandbox/Browser** lässt sich die Safe-Area nur begrenzt simulieren (DevTools-Geräte-Emulation mit Notch-Profil zeigt die Insets). Der **echte Test ist Lauras installiertes Homescreen-PWA nach dem Deploy** — dort manifestiert sich `env(safe-area-inset-*)` real. Code prüft: kein Horizontal-Overflow (Desktop+Mobile-Emulation), CSS-`env()` korrekt angewendet, Build grün. Im Bündel klar kennzeichnen, dass der finale Safe-Area-Beweis am Gerät erfolgt.
- Kein `db push`/`db:reset`. Dev: `cd app && pnpm dev`.

---

## 6. Abschluss (autonom, ohne Push)

Build grün + Backend-Tests grün → Code committet selbst (Granularität dokumentiert; kein `Co-Authored-By`) → `BERICHTE/PWA_LAYOUT_BUENDEL.md` mit echtem `git status` + `git log` + Vorher/Nachher je Bug + Hinweis „Safe-Area final am Gerät verifizieren" → **STOPP ohne Push.** Laura reviewt, pusht, deployt (git pull + rebuild + restart), testet am Handy.
