# Sub-Commit B1b — CLAUDE.md auf Post-Konsolidierungs-Stand aktualisieren

**Typ:** Doku-Edit (single file)
**Logische Aussage:** „CLAUDE.md auf Post-Konsolidierungs-Stand aktualisieren."
**Datei:** `CLAUDE.md` (eine einzige Datei wird verändert)
**Geschätzte Dauer:** 8-12 Minuten

---

## Kontext

Nach der Phase-1-Konsolidierung (Smoke-Test bestanden) ist `CLAUDE.md` an drei Stellen unvollständig:

1. **Sektion 5 (Tooling-Konventionen):** Es fehlen Domänen-Konventionen, die Claude Code in Phase B2 wissen muss, damit er nicht falsche Defaults baut (Beträge in Cent als `Int`, `guthabenCent` darf negativ sein, `preisAtKaufCent` einfrieren, Soft-Disable, feste Kategorien, kein Self-Signup).
2. **Sektion 9 (Berichts-Skepsis):** Lehre aus dem Phase-1-Doku-Konflikt (`01-grundgeruest.md` vs `CODE_PROMPT_PHASE1.md`) fehlt — wenn Claude Code mehrere Specs für dieselbe Phase findet, soll er stoppen, nicht raten.
3. **Sektion 7 (Sandbox-Setup):** Veralteter Warn-Hinweis zum Port-Mapping. Seit Commit `2122bbf` ist der Setup-Fix drin (Port `3001:3001`, Vite-Host `0.0.0.0`). Der Warn-Block ist überflüssig.
4. **Zusätzlich:** Es fehlt eine Sektion mit Verweisen auf die anderen Doku-Quellen (`KONFIGURATION.md`, `PROMPTS/`, `design/`, `BERICHTE/`), damit Claude Code bei Bedarf weiß, wo welche Detail-Info liegt.

Alle vier Änderungen werden in **einem** Sub-Commit zusammengefasst, weil sie alle dieselbe Datei betreffen und thematisch eine logische Einheit bilden („CLAUDE.md auf aktuellen Stand bringen nach Konsolidierung").

---

## Schritt-für-Schritt

### Vorbereitung — aktueller Stand anschauen

```bash
cd /home/claude/workspace
cat CLAUDE.md | head -160
```

Stell sicher, dass die Datei mit „**Letzte Aktualisierung:** 2026-05-25" endet (Zeile 157). Falls nicht, STOPP — Laura fragen.

---

### Edit 1 — Sektion 5 erweitern (Domänen-Konventionen)

**Wo:** In Sektion 5 „Tooling-Konventionen", **nach** der Unterüberschrift „Branch-Strategie" (Zeile ~92-94), **vor** dem `---`-Trenner zu Sektion 6.

**Was einfügen** (neue Unterüberschrift unter „Branch-Strategie"):

```markdown
### Domänen-Konventionen (Geschäftslogik)

Bei allen Code-Edits, die Beträge oder Getränke betreffen:

- **Beträge in Cent als `Int`.** Niemals `Float` für Geldbeträge. Beispiel: `2,50 €` → `250` (Cent).
- **`guthabenCent` darf negativ sein.** Keine DB-Constraint dagegen. Negatives Guthaben = Schulden, ist erlaubt.
- **`preisAtKaufCent` einfrieren.** In `Transaktion` wird der Preis zum Kaufzeitpunkt eingefroren. Preisänderungen am Drink ändern nie historische Transaktionen.
- **Soft-Disable statt Hard-Delete.** Drinks via `isActive=false` ausblenden, nicht löschen. Bestehende Transaktionen referenzieren weiterhin den `drinkId`.
- **Drink-Kategorien fest:** `alkoholfrei`, `alkoholisch`, `sonstiges`. Kein „Heißgetränk", keine User-definierten Kategorien.
- **Keine Lieblings-Sorte pro User.** Trinkjournal ist sortenagnostisch (nur Anzahl/Beträge). Sortenstatistik existiert nur App-weit aggregiert für Admin-Einkaufsplanung.
- **Magic-Link Auth, kein Self-Signup.** User kommen ausschließlich via Admin-Invite ins System.
```

---

### Edit 2 — Sektion 7 entrümpeln (Setup-Fix-Hinweis ist erledigt)

**Wo:** Sektion 7 „Sandbox-Setup".

**Aktueller Stand (Zeile 117-118):**

```markdown
- **Port-Mappings:** `3000:3000` und `4000:4000`
  - ⚠️ **Hinweis:** Vite-Dev läuft auf **3001**, nicht 3000. Port-Mapping ist nicht aktuell — Mac-Browser kann Frontend nicht erreichen. Wird in Phase B-Konsolidierung gefixt.
```

**Ersetzen durch:**

```markdown
- **Port-Mappings:** `3001:3001` (Frontend Vite) und `4000:4000` (Backend Express). Vite-Host ist auf `0.0.0.0` gesetzt, damit der Mac-Browser den Container erreicht.
```

---

### Edit 3 — Sektion 9 erweitern (Drift-Pattern-Lehre)

**Wo:** In Sektion 9 „Berichts-Skepsis", **nach** der „Symptome..."-Liste (Zeile ~142-145), **vor** dem `---`-Trenner zu Sektion 10.

**Was einfügen** (neue Unterüberschrift):

```markdown
### Drift-Pattern aus Bergwacht-Phase 1

In der Geschichte dieses Projekts gab es zwei widersprüchliche Phase-1-Specs (`01-grundgeruest.md` und `CODE_PROMPT_PHASE1.md`), die aus unterschiedlichen Chats entstanden waren. Claude Code musste eigenständig wählen.

**Lehre:** Wenn du in `PROMPTS/` mehrere Specs findest, die dasselbe Thema adressieren — STOPP, nicht eigenmächtig wählen. Laura fragen.

**Vermeidungs-Konvention:** In `PROMPTS/` liegt **eine** Spec pro Phase, benannt `0X-name.md`. Wenn jemand eine zweite Variante schreibt, gehört eine davon ins `archiv/` mit Warn-Header.
```

---

### Edit 4 — Neue Sektion 11 anhängen (Verweise)

**Wo:** **Nach** der bestehenden Sektion 10 „Wann diese Datei geändert wird" (endet ~Zeile 153), **vor** der `---`-Linie und dem „Letzte Aktualisierung"-Marker.

**Was einfügen** (zwischen dem `---` von Sektion 10 und dem „Letzte Aktualisierung"-Block):

```markdown
## 11. Verweise

Diese Datei (`CLAUDE.md`) regelt **wie** wir arbeiten. Für **was wir bauen** gilt:

- **`KONFIGURATION.md`** — Tech-Stack, Datenmodell (User, Drink, Transaktion, Invite),
  DSGVO-Position, Phasen-Roadmap (B1–B7), Domain, Identitäten.
  Source of Truth für Geschäftslogik-Entscheidungen.

- **`PROMPTS/0X-*.md`** — konkrete Spec der aktuell laufenden Phase.

- **`design/README_DESIGN.md`** — Design-System (Dark-Bar-Ästhetik, Fonts, Tokens, Komponenten).
  Source of Truth für visuelles Design.

- **`design/design-tokens.css`** — Source of Truth für Farben (OKLCH), Spacings, Radius.

- **`BERICHTE/`** — Berichte aus früheren Phasen (nicht in Git, lokal).

Bei Konflikt zwischen diesen Quellen: höhere Tier in der Hierarchie (Sektion 2) gewinnt.

---
```

(Der `---`-Trenner ist Teil der neuen Sektion, damit sie sauber vom „Letzte Aktualisierung"-Marker getrennt ist.)

---

### Edit 5 — Datum aktualisieren

**Wo:** Allerletzte Zeile.

**Vorher:**
```markdown
**Letzte Aktualisierung:** 2026-05-25 (Initial-Version nach Phase 1 mit rückwirkender Konsolidierung)
```

**Nachher:**
```markdown
**Letzte Aktualisierung:** 2026-05-26 (Erweiterungen nach Phase-1-Smoke-Test: Domänen-Konventionen, Drift-Pattern-Lehre, Verweise, Setup-Fix-Hinweis aktualisiert)
```

---

## Verifikation

Nach allen fünf Edits:

```bash
cd /home/claude/workspace
git status
git diff CLAUDE.md
```

**Erwartung von `git status`:**
- `CLAUDE.md` als modified
- Keine anderen Dateien angefasst

**Erwartung von `git diff CLAUDE.md`:**
- Nur Additionen + die zwei kleinen Replacements (Sektion 7 Port-Mapping, Datum am Ende)
- Keine versehentlich gelöschten Zeilen
- Sektion-Nummern noch korrekt (1-11)

Außerdem **inhaltliche Prüfung:**

```bash
grep -n "^## " CLAUDE.md
```

**Erwartete Ausgabe:**
```
## 1. Verhaltens-Regeln (immer)
## 2. Source-of-Truth-Hierarchie
## 3. Phase-Workflow
## 4. Datei-Ablage
## 5. Tooling-Konventionen
## 6. Tech-Stack (Kurz-Referenz)
## 7. Sandbox-Setup
## 8. Verbotene Verhalten
## 9. Berichts-Skepsis (wichtige Lehre)
## 10. Wann diese Datei geändert wird
## 11. Verweise
```

Falls eine Sektion fehlt oder doppelt auftaucht: STOPP.

---

## Kurz-Bericht im Chat

5-10 Zeilen Zusammenfassung:
- Datei modified: `CLAUDE.md`
- Erweiterungen (kurz): „+ Sektion 5 um Domänen-Konventionen, Sektion 7 Setup-Fix-Hinweis aktualisiert, Sektion 9 um Drift-Pattern-Lehre, neue Sektion 11 mit Verweisen, Datum"
- Output von `grep -n "^## " CLAUDE.md`
- `git diff CLAUDE.md` zeigen (oder Hinweis, dass Diff zu groß für Chat, dann nur Stats: `git diff --stat CLAUDE.md`)

---

## Freigabe-Wartepunkt

**STOPP.** Auf Lauras Freigabe warten, bevor `git commit`.

---

## Commit-Message (nach Freigabe)

```
docs: CLAUDE.md auf Post-Konsolidierungs-Stand aktualisieren

- Sektion 5: Domänen-Konventionen ergänzt (Cent als Int, guthabenCent
  darf negativ sein, preisAtKaufCent einfrieren, Soft-Disable,
  feste Kategorien, kein Self-Signup)
- Sektion 7: Setup-Fix-Hinweis aktualisiert (Port-Mapping korrekt
  seit Commit 2122bbf)
- Sektion 9: Drift-Pattern-Lehre aus Phase-1-Doku-Konflikt
- Sektion 11: Neuer Verweis-Block auf KONFIGURATION.md, PROMPTS/,
  design/, BERICHTE/
```

Nach Commit: `git log -1` zeigen.

---

## Was NICHT zu tun ist

- ❌ Keine Änderungen an anderen Dateien (nicht `KONFIGURATION.md`, nicht Code)
- ❌ Keine eigenmächtigen Umformulierungen der bestehenden Sektionen 1-10
- ❌ Kein `git push`
- ❌ Kein `git commit` ohne Lauras Freigabe
