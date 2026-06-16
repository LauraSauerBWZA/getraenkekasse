# Phase B5c — Visual Redirection (Re-Skin: kühl, mehrfarbig, Glass, Sans)

**Phase:** B5c — definiert das Design-System **neu** (nicht nur Politur). Baut auf B5b (Primitive-Konsolidierung) auf. Logische Einheiten siehe §4 — **Commit-Granularität entscheidet Code selbst** und dokumentiert sie.
**Autorität (Tier 5) wird in DIESER Phase neu geschrieben:** `design/design-tokens.css` + `design/README_DESIGN.md`. Außerdem `KONFIGURATION.md` §8 + Änderungshistorie (Update 10) anpassen, da die alte „Amber/Fraunces/Berghütten-Bar"-Beschreibung überholt ist.
**Voraussetzung:** B5b liegt lokal (ungepusht, ahead). **Reine Frontend-Präsentation. Kein Schema-Change, kein `db push`. Keine Logik-/Endpoint-/Datenänderung. Keine neue Dependency** (Inter ist im Stack; kein Chart-Lib, keine neue Schrift).
**Modus:** Voll autonom — Code committet selbst, pusht nicht. Kein `Co-Authored-By`. (B5b + B5c werden **gemeinsam am Ende von Laura gepusht**.)

---

## 0. Erster Schritt — den /api-Fix sichern

Im Working Tree liegt bereits eine uncommittete Änderung an `frontend/src/lib/api.ts` (API-Basis von hartkodiertem `localhost:4000` auf relativen `/api`-Proxy). **Zuerst als eigenen Commit sichern**, bevor der Re-Skin beginnt (damit er nicht im großen Diff untergeht — er ist deploy-relevant):

```
git add app/frontend/src/lib/api.ts
git commit -m "fix(frontend): API-Basis auf relativen /api-Proxy statt hartkodiertem localhost:4000"
```

Dann B5c bauen.

---

## 1. Arbeitsmodus (volle Autonomie, steht in CLAUDE.md)

Autonom bauen, keine Echtzeit-Rückfragen, Granularität selbst wählen + dokumentieren, selbst committen wenn Frontend-Build + Backend-Tests grün. STOPP nur bei echtem Blocker (insb. **neue Dependency** — nicht nötig). **Kein `git push`**. Bündel-Bericht mit echtem `git status` + `git log --oneline -N`. **Kein `Co-Authored-By`.**

---

## 2. Schritt 0 — Recherche (read-only)

Session-Start: `git status -sb` + `git log --oneline -6` (lokal, kein `git fetch`). Bericht in `BERICHTE/PHASE_B5c_SCHRITT0.md` + 5–10 Zeilen. Prüfen:
1. **`design/design-tokens.css`**: aktuelle Token-Struktur (`--bwza-*`, OKLCH), welche Namen wo referenziert werden (Amber/Fraunces/rescue/success/ink…). Strategie für Token-Namen festlegen (semantisch umbenennen **oder** Werte repurposen) — **dokumentieren**.
2. **`design/README_DESIGN.md`**: was beschrieben ist (wird neu geschrieben).
3. **Primitives** (`primitives.tsx` + B5b-Bausteine: Glass, ShineEdge, GlassButton, GlassInput, Avatar, StatCard, StatusChip, EmptyState, Skeleton, BottomNav, ProfileDrawer): wo sitzen die Farb-/Font-Werte zentral?
4. **Fraunces-Einbindung** (Font-Import, `--bwza-font-display`): Entfernungspunkte.
5. **Wo werden Beträge/Salden gerendert** (aktuell Fraunces) → auf Sans/tabellarisch umstellen.

Kein `db push`, kein Blocker.

---

## 3. Das neue Design-System (bestätigte Richtung)

### Palette (Hex → in OKLCH/Token-Format übersetzen)

| Rolle | Wert | Einsatz |
|---|---|---|
| App-Grund | `#0D1116` | dunkler, **kühler** Charcoal |
| Karten-Basis (optional) | `#141922` | falls eine Volltonebene nötig |
| Ink (primär) | `#EEF1F4` | Haupttext, große Zahlen |
| Ink dim | `#9AA4B0` | Sekundärtext |
| Ink mute | `#6B7480` | Labels, Hints |
| **Teal — Primär** | `#2BD4BC` | CTA, aktive Zustände, Marke (Text drauf: `#04342C`) |
| Blau — Info | `#4D8EF7` | Info / weitere Kategorie |
| Gold — Warnung | `#F4B740` | „offen", Warnung |
| Grün — Erfolg | `#34D399` | Aufladung, „bestätigt", positiv |
| Koralle — Negativ | `#FF5C61` | Schulden, Storno, Deckung negativ, „abgelehnt" |

**Kategoriales Set** (Daten-Viz / Drink-Kategorien): Teal, Blau, Gold, Grün, Koralle (Reihenfolge). Bei Bedarf 6. Farbe ergänzen (z.B. Violett), aber sparsam.

### Glass-Look (zentral in den Tokens + Glass/ShineEdge)

- **Glass-Fläche:** `rgba(255,255,255,0.05)` (Karten), `0.06` für Hero/betonte Flächen.
- **Hairline-Border:** `rgba(255,255,255,0.10)`.
- **ShineEdge:** zarte obere Lichtkante `rgba(255,255,255,0.18–0.22)` (1px, leicht eingerückt).
- **Backdrop-Blur:** `backdrop-filter: blur(16–20px)` (CSS, keine Dependency) → echter Milchglas-Effekt über dem Grund.
- **Radien großzügig:** sm 10 / md 14 / lg 18 / xl 22 / pill 999.

### Typografie — Inter durchgehend (Fraunces RAUS)

- **Inter** als einzige Display+UI-Schrift (schon im Stack). Fraunces-Import + `--bwza-font-display`-Serif **entfernen**.
- Große Zahlen (Guthaben, Hero, StatCard-Werte): **Weight 300**, leicht negatives Letter-Spacing.
- Sektions-Labels: **Versalien, Letter-Spacing ~2px**, in Ink-mute.
- Body/UI: regular. **Beträge tabellarisch rechtsbündig** (`font-variant-numeric: tabular-nums`).
- Mono (`--bwza-font-mono`) bleibt nur für echte Code-Kontexte (derzeit keine).

### Semantik-Mapping (HART — Domäne)

negatives Guthaben / Schulden / Deckung negativ / Storno / abgelehnt → **Koralle**; Aufladung / bestätigt / positiv → **Grün**; offen / Warnung → **Gold**; Primär-CTA / aktiv → **Teal**; Info → **Blau**.

---

## 4. Umsetzung

### B5c.1 — Token-Schicht
`design/design-tokens.css` auf die neue Palette + Glass-Werte + Radien + Inter-Typo-Skala umstellen; Fraunces entfernen. `design/README_DESIGN.md` neu schreiben (neues System dokumentiert). `KONFIGURATION.md` §8 + Änderungshistorie (Update 10: „Visual Redirection — kühl/mehrfarbig/Glass/Inter statt Amber/Fraunces") anpassen — Diff im Bündel zeigen.

### B5c.2 — Primitives
Glass (Fläche+Blur), ShineEdge (Lichtkante), GlassButton (primär=Teal solid/dunkler Text, sekundär=Glass-Ghost, destruktiv=Koralle), GlassInput, Avatar (Teal), StatCard (Glass), StatusChip (tone→neue Tokens: offen=Gold, bestätigt=Grün, abgelehnt=Koralle), BottomNav (aktiv=Teal), ProfileDrawer, EmptyState, Skeleton, Legenden-/Transaktions-Zeile (Farbpunkt + Label + rechtsbündiger Betrag).

### B5c.3 — Member-Screens
Theke (Guthaben-Hero in Glass-Card, leichte Großzahl, Teal-CTA), Buchen, Aufladen, Verlauf (Journal-Hero/Stat-Strip/30-Tage-Balken in der neuen Palette/Glass, Achievement-Grid, Historie-Rows), Bottom-Nav + Drawer.

### B5c.4 — Admin / Kasse / Leitung / Statistik
Alle Verwaltungs-Screens auf das neue System; negative Salden/Deckung Koralle, positive Grün, Status-Chips neu. Kassen-Töpfe/Deckung, Sortenstatistik-Rows, Leitung-Ansicht.

### Bewusst NICHT in B5c
- **Gradient-/Donut-Charts mit Chart-Library** — separate Dependency-Entscheidung später bei den Chart-Screens. Hier: bestehende CSS-Balken **umfärben** auf die neue Palette, **kein** neues Chart-Lib.
- **Keine** Logik-/Endpoint-/Datenänderung, **keine** neue Dependency, **kein** Schema-Change.

---

## 5. Done-Kriterien (Lauras async Review — visuell, danach Iteration)

- [ ] `design-tokens.css` + `README_DESIGN.md` spiegeln das neue System; **Fraunces entfernt**, Amber-Identität abgelöst
- [ ] `KONFIGURATION.md` §8 + Update-10-Eintrag angepasst (Diff im Bündel)
- [ ] Alle Screens im neuen Look: **Glass-Karten mit Lichtkante**, Teal-CTAs, Koralle-Negativ, Grün-Positiv, Gold-offen, Inter, leichte Großzahlen, tabellarische Beträge
- [ ] Backdrop-Blur-Glass funktioniert (CSS, keine Dependency)
- [ ] Mobile-first; Tap-Targets, Safe-Area, Kontrast ok
- [ ] **Keine** Funktions-/Logikänderung; `pnpm --filter backend test` grün, Frontend-`build` grün

---

## 6. Sandbox-/Test-Hinweise

- Kein `db push`, kein `db:reset` (kaputt). Bei hängendem Prozess `docker restart claude-bwza-getraenke` (vom Mac). Dev: `cd app && pnpm dev`.
- **Browser-Test:** alle Screens auf **schmaler Viewport-Breite** (Handy-Login ist gerade fummelig → Mac-Browser + DevTools-Geräte-Emulation reicht für den Look). Konsistenz prüfen: gleiche Glass-Karten, Teal-Akzente, Koralle/Grün-Semantik, Inter überall, leichte Großzahlen. Im Bündel eine **Screen-für-Screen-Liste mit Vorher/Nachher-Stichworten**.

---

## 7. Abschluss (autonom, ohne Push)

Frontend-Build + Backend-Tests grün → Code committet selbst (Granularität dokumentiert; kein `Co-Authored-By`) → `BERICHTE/PHASE_B5c_BUENDEL.md` mit echtem `git status` + `git log --oneline -N` + `KONFIGURATION.md`-Diff + Screen-Stichworten + Browser-Test-Anleitung → **STOPP ohne Push.** Laura reviewt visuell; danach Push von **B5b + /api-Fix + B5c gemeinsam** (+ Specs als chore) und voraussichtlich eine kleine Feinschliff-Iteration.
