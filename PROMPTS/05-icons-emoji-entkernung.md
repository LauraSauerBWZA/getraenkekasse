# B5-Icons — Emoji-Entkernung + Line-Icon-System (lucide-react)

**Typ:** Visuelle Runde (schließt die Visual-Redirection ab). Logische Einheiten siehe §3 — **Granularität entscheidet Code selbst**.
**Autorität (Tier 5):** `design/design-tokens.css` + `design/README_DESIGN.md` (B5c-System). `KONFIGURATION.md` §7.1/§7.2 anpassen (Emoji-Glyphen in Labels → Icons) + Änderungshistorie (Update 12).
**Voraussetzung:** B5c + Feinschliff liegen (lokal/gepusht). **Eine neue Dependency ist freigegeben: `lucide-react`.** Sonst keine. **Kein Schema-Change, kein `db push`, keine Logik-/Endpoint-/Datenänderung.**
**Modus:** Voll autonom — Code committet selbst, pusht nicht. Kein `Co-Authored-By`.

> **Freigegebene Ausnahme:** `lucide-react` darf installiert werden (`pnpm --filter frontend add lucide-react`) — das ist **kein** STOPP-Grund, Laura hat die Dependency bewusst freigegeben. Sonst gilt: keine weiteren neuen Dependencies.

---

## 1. Arbeitsmodus

Autonom, selbst committen wenn Frontend-Build + Backend-Tests grün. STOPP nur bei echtem Blocker (außer der freigegebenen lucide-react-Installation). **Kein `git push`.** Bündel-Bericht mit echtem `git status` + `git log`. Kein `Co-Authored-By`.

---

## 2. Schritt 0 — Emoji-Inventar (read-only)

`git status -sb` + `git log --oneline -5` (lokal, kein `fetch`). Dann **alle Emoji-Vorkommen** im Frontend finden → `BERICHTE/B5_ICONS_SCHRITT0.md` + 5–10 Zeilen. Erfassen, wo Emojis sitzen:
- **Bottom-Nav** (Theke/Aufladen/Verlauf),
- **Admin-Hub-Cards** (Mitglieder, Einladen, Drink-Katalog, Aufladungs-Anfragen, Bargeld-Aufladung, Vereinskasse/Kasse, Sortenstatistik, Profil),
- **Leitung-Bereich** + ggf. weitere Sektions-Labels/Buttons,
- alle übrigen Emoji-Glyphen in `routes/` + `components/`.

**Achievements (`Verlauf`/Trinkjournal) ausnehmen** — die Emojis dort bleiben (🏔️🌧️⛺🎒🪙🎖️🧗).

---

## 3. Änderungen

### 3.1 lucide-react einbinden
`lucide-react` als Frontend-Dependency installieren (freigegeben). Konsistente Nutzung: einheitliche Größe, Stroke-Width, Farbe über Tokens (Ink für inaktiv, **Teal** für aktiv/Akzent).

### 3.2 Emojis → Line-Icons (überall AUSSER Achievements)
Alle Emoji-Glyphen außerhalb der Achievements durch passende lucide-Icons ersetzen. Vorschlags-Mapping (Code wählt sinnvolle lucide-Namen + dokumentiert):
- **Bottom-Nav:** Theke → `Home`, Aufladen → `Wallet`/`CreditCard`, Verlauf → `History`/`Clock`
- **Admin-Hub:** Mitglieder → `Users`, Einladen → `UserPlus`/`Mail`, Drink-Katalog → `Beer`/`CupSoda`, Aufladungs-Anfragen → `Inbox`/`CreditCard`, Bargeld-Aufladung → `Banknote`/`Coins`, Vereinskasse/Kasse → `Landmark`/`PiggyBank`, Sortenstatistik → `BarChart3`, Profil/PayPal-Link → `User`/`Link`
- **Leitung:** Kassen-Einsicht → `Landmark`, Statistik → `BarChart3`
- ggf. Back-Pfeil (`BackBar`) → `ChevronLeft`/`ArrowLeft`, falls aktuell ein Glyph
- Aktiver Nav-Tab: Icon in **Teal**, inaktiv in Ink-mute (konsistent mit dem bestehenden Aktiv-Zustand).

### 3.3 NICHT anfassen
- **Achievement-Emojis bleiben** (🏔️🌧️⛺🎒🪙🎖️🧗) — explizit erhalten.
- **Drink-Kategorie-Marker** (B5c-Feinschliff, Farbmarker) bleiben wie sie sind — kein Emoji dort, kein Handlungsbedarf.
- **BergMark-Logo** ist kein Emoji → bleibt.
- Keine Logik-/Schema-/weitere Dependency-Änderung.

### 3.4 Doku
`KONFIGURATION.md` §7.1/§7.2: Emoji-Glyphen in den Tab-/Card-Labels entfernen bzw. durch Icon-Bezeichnung ersetzen; Hinweis „Line-Icons (lucide-react); Achievements behalten Emojis". Änderungshistorie Update 12. Diff im Bündel.

---

## 4. Done-Kriterien (Lauras Review)

- [ ] **Keine Emojis mehr** in Nav, Admin-/Leitung-Cards, Sektions-Labels, Buttons — durch konsistente lucide-Line-Icons ersetzt
- [ ] **Achievements behalten ihre Emojis** (unverändert)
- [ ] Icons konsistent (Größe/Stroke/Farbe), aktiver Nav-Tab Teal
- [ ] Drink-Kategorie-Marker unverändert; BergMark unverändert
- [ ] `lucide-react` als einzige neue Dependency; `KONFIGURATION.md` §7.1/§7.2 + Update 12 (Diff im Bündel)
- [ ] Keine Funktions-/Logikänderung; `pnpm --filter backend test` grün, Frontend-`build` grün

---

## 5. Sandbox-/Test

Kein `db push`/`db:reset`. Bei stale: `docker restart claude-bwza-getraenke` (Mac). Dev: `cd app && pnpm dev`. Test: Mac-Browser + DevTools-Mobilansicht (~390px), `localhost:3001`.

---

## 6. Abschluss (autonom, ohne Push)

Checks grün → selbst committen (Granularität dokumentiert; kein `Co-Authored-By`) → `BERICHTE/B5_ICONS_BUENDEL.md` mit echtem `git status` + `git log --oneline -N` + `KONFIGURATION`-Diff + Icon-Mapping-Liste → **STOPP ohne Push.** Laura reviewt, testet, pusht.
