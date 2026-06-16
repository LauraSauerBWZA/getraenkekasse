# Drink-Erweiterung — Marke + Volumen (ml) + alphabetische Sortierung + Subzeile

**Typ:** Backend + Frontend + **Schema-Änderung** (zwei neue optionale Drink-Felder). Logische Einheiten siehe §3 — **Granularität entscheidet Code selbst**.
**Source of Truth:** `KONFIGURATION.md` §5.2 (Drink) — wird hier erweitert (Update 16). Tier-2 (Code/Realität) bleibt maßgeblich.
**Voraussetzung:** Baut auf den bereits gebauten, noch ungepushten Frontend-Fixes auf (PWA-Layout, Mailtext/devToken, Wisch+Kontrast). Diese **nicht** rückgängig machen.
**Erwartung:** **Schema-Änderung nötig** (neue optionale Felder = additiv/nicht-destruktiv). **`db push` NUR auf der Sandbox-Dev-DB** zum Testen (danach Dev-Server neu starten). **Kein** `db push` auf Prod (macht Laura beim Deploy nach Backup). **Keine neue Dependency.**
**Modus:** Voll autonom — Code committet selbst, pusht nicht. Kein `Co-Authored-By`.

> **Wichtig zum Schema:** Beide neuen Felder **optional/nullable** anlegen → additiv, bestehende Drinks behalten ihre Daten (neue Felder = null). Kein Umbenennen/Löschen bestehender Spalten. So ist der spätere Prod-`db push` nicht-destruktiv.

---

## 1. Arbeitsmodus

Autonom, selbst committen wenn alle drei grün: `pnpm --filter backend test`, `pnpm --filter backend build`, `pnpm --filter frontend build`. STOPP nur bei echtem Blocker. **Kein `git push`.** Bündel mit echtem `git status` + `git log`. Kein `Co-Authored-By`.

---

## 2. Schritt 0 — Recherche (read-only)

`git status -sb` + `git log --oneline -4` (lokal, kein `fetch`). Bericht → `BERICHTE/DRINK_ERWEITERUNG_SCHRITT0.md` + 5–10 Zeilen. Klären:
1. **Drink-Modell** (`schema.prisma`): aktuelle Felder (`name`, `preisCent`, `icon?`, `kategorie`, `isActive`).
2. **Validierung** (Zod, wo Drink-Create/Update geprüft wird — `domain/` o.ä.): wo die neuen optionalen Felder rein müssen.
3. **Admin-Katalog-Formular** (`AdminDrinks.tsx`): wo Eingabefelder + Liste sind (das Icon-Emoji-Feld ist seit B5c raus — `icon` bleibt im Modell, ungenutzt).
4. **Anzeige-Stellen** des Drinks: Buchen-Screen (`Buchen.tsx` — DrinkRow/ConfirmSheet), Admin-Katalog-Zeile (`AdminDrinks.tsx`), Sortenstatistik (`Sortenstatistik.tsx`). Wo wird der Name gerendert? (für Name + Subzeile).
5. **Aktuelle Sortierung** der Drink-Listen (Backend-`orderBy` oder Frontend) — für die alphabetische Sortierung.

---

## 3. Inhalt

### 3.1 Schema: zwei neue optionale Felder am Drink
- `marke String?` — Markenbezeichnung (z. B. „Störtebeker", „Adelholzener"), optional.
- `volumenMl Int?` — Größe in Millilitern (z. B. 500, 330, 200), optional.
- Beide **nullable**, additiv. Danach **`db push` auf der Dev-DB** + **Dev-Server neu starten** (tsx watch lädt sonst alten Prisma-Client). Kein Prod-`db push`.

### 3.2 Validierung + Endpoints
- Drink-Create/Update (Admin) nehmen `marke` (String, optional) + `volumenMl` (Int, optional, > 0 wenn gesetzt) entgegen, Zod-validiert. Bestehende Felder unverändert.

### 3.3 Admin-Katalog-Formular (AdminDrinks.tsx)
- Zwei neue Eingaben: **Marke** (Text, optional) und **Volumen in ml** (Zahl, optional, Platzhalter z. B. „500"). Klar beschriftet, beide optional (kein Pflichtfeld).

### 3.4 Anzeige: Name + Subzeile
- **Name** = Haupttext (fett, wie bisher).
- **Subzeile** darunter, klein + gedämpft (Design-Tokens, gleicher Stil wie andere Sub-Labels): **`Marke · Größe`**, wobei „Größe" aus `volumenMl` formatiert wird. Nur die **vorhandenen** Teile anzeigen (mit „ · " verbinden); fehlt beides → keine Subzeile.
- **Volumen-Formatierung** (Helper, z. B. `formatVolumen(ml)`): ml → Liter mit deutschem Komma, „l"-Suffix, Nachkommastellen sinnvoll: `500 → „0,5 l"`, `330 → „0,33 l"`, `200 → „0,2 l"`, `1000 → „1 l"`, `1500 → „1,5 l"`.
- Konsistent in **Buchen** (DrinkRow + ConfirmSheet) und **Admin-Katalog-Zeile**. Sortenstatistik: dort reicht der Name (Subzeile optional, Code-Ermessen — nicht überfrachten).

### 3.5 Alphabetische Sortierung
- Drink-Listen **alphabetisch nach Name** sortieren, **deutsch-korrekt** (ä/ö/ü, Groß/Klein egal) — am einfachsten Frontend-seitig via `localeCompare('de', { sensitivity: 'base' })` (SQLite-`orderBy` sortiert ASCII-falsch bei Umlauten). Wirkt im **Buchen-Screen** und im **Admin-Katalog**. Innerhalb der Kategorie-Gruppierung (Buchen) alphabetisch.

### 3.6 Doku
`KONFIGURATION.md` §5.2: `marke`/`volumenMl` ergänzen; Update 16 (additiv, zwei optionale Drink-Felder + alphabetische Sortierung). Diff im Bündel.

### Tests
- Drink-Create/Update mit `marke` + `volumenMl` → gespeichert + zurückgegeben; ohne sie → weiterhin gültig (optional).
- `formatVolumen`-Helper: 500/330/200/1000 → korrekte Strings (kleiner Unit-Test).
- Bestehende Drink-Tests bleiben grün.

### Bewusst NICHT
- Kein Umbenennen/Löschen bestehender Felder (`icon` bleibt ungenutzt im Modell). Keine neue Dependency. Kein Prod-`db push`.

---

## 4. Done-Kriterien (Lauras Review)

- [ ] Drink hat optionale `marke` + `volumenMl`; Admin-Formular hat beide Eingaben (optional)
- [ ] Drink-Zeile zeigt **Name** + kleine **Subzeile „Marke · 0,5 l"** (nur vorhandene Teile); keine Subzeile wenn beides leer
- [ ] `volumenMl` wird korrekt als Liter mit Komma formatiert (500→„0,5 l", 330→„0,33 l")
- [ ] Drink-Listen **alphabetisch** (deutsch, inkl. Umlaute) in Buchen + Admin-Katalog
- [ ] Schema additiv (beide Felder nullable); Dev-`db push` ok; **kein** Prod-`db push`
- [ ] `KONFIGURATION.md` §5.2 + Update 16
- [ ] backend test + backend build + frontend build grün; keine neue Dependency

---

## 5. Sandbox-/Test-Hinweise

- Nach Schema-Edit: **`db push` auf der Dev-DB** (`pnpm prisma db push` im backend) → **Dev-Server neu starten** (`docker restart claude-bwza-getraenke`, dann `pnpm dev`). Kein `db:reset` (kaputt).
- **Kein Prod-Zugriff** — Prod-`db push` macht Laura beim Deploy (nach Backup).

---

## 6. Abschluss (autonom, ohne Push)

Alle Gates grün → Code committet selbst (Granularität dokumentiert; kein `Co-Authored-By`) → `BERICHTE/DRINK_ERWEITERUNG_BUENDEL.md` mit echtem `git status` + `git log` + §5.2-Diff + **deutlichem Hinweis: dieser Deploy braucht einen Prod-`db push` (additiv) → Backup zuerst** → **STOPP ohne Push.** Laura reviewt, pusht, deployt (Backup → git pull → db push → build → restart).
