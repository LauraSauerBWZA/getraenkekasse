# Cleanup — AUSLAGE-Kassentyp streichen

**Typ:** Cleanup (keine Roadmap-Phase). Kleiner, mechanischer Refactor + Spec-Amendment.
**Entscheidung (Laura):** `AUSLAGE` wird gestrichen — **redundant** zu `EINKAUF`/`ENTNAHME` aus dem eigenen Verwalter-Topf. Beide dürfen den Topf negativ machen (= „Verein schuldet dem Verwalter"); „Auslage" beschrieb nur die Geldquelle (privat), die ohnehin im negativen Topf steckt, und lieferte keine saubere eigene Auswertungs-Kategorie.
**Source of Truth:** `KONFIGURATION.md` Update 8 → wird in diesem Cleanup zu **Update 9**.
**Voraussetzung:** B2i abgeschlossen (`origin/main = 695fc9a`).
**Modus:** Voll autonom — Code committet selbst, pusht nicht. Kein `Co-Authored-By`.
**Kein Schema-Change, kein `db push`** (`typ` ist String-Spalte + Zod-Konstante).

---

## 1. Schritt 0 — kurz (read-only)

`git status -sb` + `git log --oneline -3` (lokal, kein `fetch`). Dann **alle `AUSLAGE`-Vorkommen** finden (`grep -rn AUSLAGE app/ KONFIGURATION.md`) und im Schritt-0-Bericht (`BERICHTE/CLEANUP_AUSLAGE_SCHRITT0.md`, 5–10 Zeilen) auflisten, wo überall angefasst wird. Erwartete Orte: `domain/kassen-typ.ts`, `routes/kasse.ts`, `tests/auth-flow.test.ts`, `frontend/src/routes/AdminKasse.tsx`, ggf. `lib/api.ts`, plus `KONFIGURATION.md`.

---

## 2. Inhalt

### Code

1. **`domain/kassen-typ.ts`** — `AUSLAGE` aus der Typ-Konstante entfernen (7 → 6 Typen: `EINZAHLUNG, EINLAGE_BOX, EINKAUF, ENTNAHME, SPENDE, KORREKTUR`).
2. **`routes/kasse.ts`** — `AUSLAGE` aus der `buchung`-Endpoint-Logik entfernen: die Vorzeichen-Regel für AUSLAGE und die Sonderregel „AUSLAGE erzwingt VERWALTER" raus. `EINKAUF`/`ENTNAHME` bleiben unverändert (Konto VERWALTER **oder** BOX, dürfen Topf negativ machen).
3. **Frontend `AdminKasse.tsx`** — das „Auslage"-Aktions-Sheet/den Button entfernen. Bleiben **fünf** Aktionen: Einkauf, Entnahme, Einlage in die Box, Spende, Korrektur.
4. **`lib/api.ts`** — falls eine eigene Auslage-Methode existiert, entfernen (sonst nutzt das gemeinsame `buchung` ohnehin keinen AUSLAGE-Pfad mehr).
5. **Tests** — AUSLAGE-spezifische Tests entfernen. Sicherstellen, dass der Negativ-Topf-Fall weiterhin abgedeckt ist (über `EINKAUF`/`ENTNAHME` aus dem eigenen Topf). Suite muss grün bleiben.

> **Bestandsdaten:** Falls in der Dev-DB Test-`AUSLAGE`-Zeilen liegen, bleiben sie als String erhalten und rendern in der Historie weiter (kein Migrationsbedarf). Optional `seed` frisch — nicht nötig.

### Spec — `KONFIGURATION.md` auf Update 9

Mechanische Entfernung aller AUSLAGE-Erwähnungen, Stand-Marker oben auf Update 9, plus Historien-Eintrag:

- **Kopf:** `Stand: … (Update 8 …)` → `Update 9: AUSLAGE gestrichen`.
- **§4** Verwalter-Rechte: „… Geld in die Box legen, **Auslagen erfassen,** Spenden eintragen …" → „Auslagen erfassen," raus.
- **§5.6** Typen-Tabelle: `AUSLAGE`-Zeile entfernen; die Aufzählung der Typen oben (`… ENTNAHME, AUSLAGE, SPENDE …`) ohne AUSLAGE.
- **§6.8** Geldflüsse-Tabelle: Zeile „Auslage Privattasche" entfernen.
- **§7.6** Kassen-Screen Aktionen: „… Einlage in die Box, **Auslage,** Spende …" → Auslage raus.
- **§13** Änderungshistorie, neuer Eintrag oben:

```
**Update 9 (15.06.2026):** AUSLAGE-Typ gestrichen
- Redundant zu EINKAUF/ENTNAHME aus dem eigenen Verwalter-Topf (beide dürfen
  den Topf negativ machen = „Verein schuldet dem Verwalter").
- „Auslage" beschrieb nur die Geldquelle (privat), die ohnehin im negativen
  Topf abgebildet ist, und lieferte keine saubere eigene Auswertungs-Kategorie.
- Kassen-Typen jetzt sechs: EINZAHLUNG, EINLAGE_BOX, EINKAUF, ENTNAHME, SPENDE, KORREKTUR.
```

---

## 3. Commit-Granularität (Vorschlag, Code entscheidet)

| Commit | Inhalt |
|---|---|
| `refactor` | `AUSLAGE`-Kassentyp aus Code entfernen (Konstante, Backend, Frontend, Tests) |
| `docs` | `KONFIGURATION.md` Update 9 — AUSLAGE gestrichen |

Trennung sinnvoll (Code vs. Spec), aber zusammen auch ok. **Die `KONFIGURATION.md`-Änderung im Bündel-Bericht als Diff zeigen**, damit Laura den Spec-Edit vor dem Push verifizieren kann (Berichts-Skepsis).

---

## 4. Done-Kriterien (Lauras async Review)

- [ ] Kassen-Screen: nur noch **fünf** Aktionen (kein „Auslage" mehr)
- [ ] Einkauf/Entnahme aus „mein Topf" funktioniert weiter, Topf darf negativ werden
- [ ] `grep -rn AUSLAGE app/ KONFIGURATION.md` → **leer**
- [ ] `pnpm --filter backend test` grün, Frontend-`build` grün
- [ ] `KONFIGURATION.md` auf Update 9, Diff im Bündel-Bericht

---

## 5. Abschluss (autonom, ohne Push)

Checks grün → selbst committen → `BERICHTE/CLEANUP_AUSLAGE_BUENDEL.md` mit echtem `git status` + `git log --oneline -N` + `KONFIGURATION.md`-Diff + kurzer Test-Hinweis → **STOPP ohne Push.** Laura reviewt, testet, pusht.
