# Phase B2e — Bargeld-Aufladung + Kassen-Ebenen-Fundament

**Phase:** B2e. Sub-Commits **B2e.1 – B2e.5**. Größte B2-Teilphase — legt das komplette Kassen-Schema.
**Source of Truth:** `KONFIGURATION.md` **Update 8** — §5.1 (User-Felder), §5.3 (`kassenTransaktionId`), §5.6 (KassenTransaktion), §6.4 (Bargeld-Aufladung), §6.3 (Aufladungs-Storno-Rückbuchung), §6.8 (Kassenführung), §4 (Rechte), §12 (Inkonsistenzen).
**Voraussetzung:** B2d abgeschlossen. `Transaktion` existiert **ohne** `kassenTransaktionId` (in B2c bewusst aufgeschoben) — wird jetzt ergänzt.
**Modus:** Autarke Bauphase, ein gebündelter STOPP am Ende.

---

## 0. Session-Start & Lese-Pflicht

Echten Branch-State aus Git ableiten (nicht aus dem Memory):
```
git fetch origin
git status -sb
git log --oneline -4
```
Erwartet: `## main...origin/main` ohne `[ahead]`, HEAD = aktueller `origin/main`. Untracked `PROMPTS/*.md` sind harmlos (nicht anfassen außer der neuen `02e-bargeld-aufladung.md`). Abweichung im Schritt-0-Bericht notieren.

**Lese-Pflicht:** 1) `CLAUDE.md` · 2) `KONFIGURATION.md` (Update 8) §5.1, §5.3, §5.6, §6.3, §6.4, §6.8, §4, §12 · 3) diese Datei. `archiv/` ist nicht Quelle.

---

## 1. Arbeitsmodus (gilt weiter)

Code entscheidet selbst: Implementierung, Struktur, Naming, REST-Detailform, Validierung, Fehlertexte, Test-Aufbau, Member-Picker-Pattern, genaue Vermerk-Behandlung.

STOPP nur bei echtem Blocker: Spec-Widerspruch, fehlende Spec, neue Dependency, technische Sackgasse.

**Unverändert (harte Regeln):** Kein `git commit` ohne Lauras Freigabe · vor Commit `git status` **und** `git diff --cached` als eigener Tool-Call · kein `git push` aus der Sandbox · kein `Co-Authored-By`.

---

## 2. Schritt 0 — Recherche (read-only)

Bericht in `BERICHTE/PHASE_B2e_SCHRITT0.md` + 5–10 Zeilen im Chat. Prüfe:

1. **Schema-Ist** — `User` (mit `isAdmin`, ohne `isLeitung`/`paypalMeLink`), `Transaktion` (mit `stornoVonId`, **ohne** `kassenTransaktionId`), `Drink`, `Invite`, `Session`.
2. **Enum-Linie** — `drink-kategorien.ts` / `transaktion-typ.ts` (String+Zod) als Vorlage für `kassen-typ.ts` und `kassen-konto.ts`.
3. **Storno-Endpoint** (`routes/buchen.ts`, aus B2d) — Struktur, damit B2e.4 ihn für die Aufladungs-Rückbuchung erweitern kann.
4. **Prisma `$transaction`** — gibt es im Code schon eine atomare Mehrzeilen-Operation? Falls nicht: das wird hier das erste Mal gebraucht (gekoppelte Buchung). Klären, wie `prisma.$transaction([...])` bzw. interaktiv genutzt wird, inkl. der wechselseitigen Verlinkung zweier neu erzeugter Zeilen.
5. **Mitglieder-Liste** — existiert ein Admin-Endpoint, der User auflistet? (Vermutlich nein — der kommt hier minimal.)
6. **Admin-Frontend** — Struktur des Admin-Bereichs (`/admin`, Karten-Muster), wo die Bargeld-Aufladung + Member-Picker andocken.
7. **`db push`** — die Änderungen sind **additiv** (neues Modell, neue nullable/Default-Felder) → kein `--accept-data-loss` nötig. Bestätigen.

Kein echter Blocker erwartet → durchbauen.

---

## 3. Sub-Commits

### B2e.1 — Schema-Fundament Kassen-Ebene (multi-verwalter-fähig)
**Aussage:** „Datenmodell um die Kassen-Ebene und Multi-Verwalter-Felder erweitern."

- **`KassenTransaktion`-Modell, voll nach §5.6:** `id`, `typ` (String/Konstante), `konto` (String/Konstante), `verwalterId` (FK→User, nullable — gesetzt bei `konto=VERWALTER`, null bei `BOX`), `betragCent` (Int), `notiz` (String, **Pflicht bei jeder Bewegung**), `transaktionId` (FK→Transaktion, nullable), `einlageGegenId` (FK→KassenTransaktion, nullable, reflexiv), `erstelltVonId` (FK→User), `createdAt`. Indizes auf FKs.
- **`Transaktion.kassenTransaktionId`** (FK→KassenTransaktion, nullable) — die in B2c aufgeschobene Kopplung. Bidirektionale Relation zu `KassenTransaktion.transaktionId`.
- **`User.isLeitung`** (Boolean, default false) + **`User.paypalMeLink`** (String, nullable) — laut §12 jetzt ins Schema, **Logik erst B2j/B2k**. Reines Vorab-Anlegen.
- **Konstanten** (String+Zod, analog Bestand):
  - `kassen-typ.ts`: `EINZAHLUNG`, `EINLAGE_BOX`, `EINKAUF`, `ENTNAHME`, `AUSLAGE`, `SPENDE`, `KORREKTUR` (alle sieben, auch wenn B2e nur `EINZAHLUNG`/`KORREKTUR` nutzt)
  - `kassen-konto.ts`: `VERWALTER`, `BOX`
- `pnpm exec prisma db push` (additiv, kein `--accept-data-loss`), Prisma-Client neu, **Dev-Server neu**.

### B2e.2 — Backend: Mitglieder-Liste (Admin)
**Aussage:** „Admin-Endpoint listet Mitglieder für die Auswahl."
- `GET` (Route-Name entscheidest du, z.B. `/admin/users`), `requireAuth + requireAdmin`.
- Aktive (nicht soft-deleted) User mit `id`, Name, Email, optional aktuelles `guthabenCent` (via `computeGuthabenCent`).
- Minimal — die reiche Übersicht + Korrektur ist B2g.

### B2e.3 — Backend: Bargeld-Aufladung (gekoppelte Buchung)
**Aussage:** „Bargeld-Aufladung erzeugt gekoppelte Mitglieder- und Kassen-Buchung atomar."
- Endpoint (z.B. `POST /admin/aufladung/bargeld`), `requireAuth + requireAdmin`. Body: `{ userId, betragCent, vermerk }`. `vermerk` **Pflicht** (trim+length), sonst `400`. `betragCent` ganzzahlig `> 0`.
- In **einer** `prisma.$transaction`:
  - `KassenTransaktion`: `typ=EINZAHLUNG`, `konto=VERWALTER`, `verwalterId=` der eingeloggte Admin, `betragCent=+X`, `notiz=vermerk`, `erstelltVonId=` Admin.
  - `Transaktion`: `typ=AUFLADUNG_BARGELD`, `userId=` Mitglied, `betragCent=+X`, `notiz=vermerk`, `erstelltVonId=` Admin, `kassenTransaktionId=` die eben erzeugte KassenTransaktion.
  - Wechselseitige Verlinkung: `KassenTransaktion.transaktionId` = die Mitglieder-Transaktion.
- Antwort: neues `guthabenCent` des Mitglieds (+ ggf. die erzeugten Zeilen).
- **`verwalterId` = eingeloggter Admin** (Multi-Verwalter-Verteilung ist B2k, degeneriert hier sauber zum Einzelfall).
- Tests: erfolgreiche Aufladung (beide Zeilen da, korrekt verlinkt, Mitglied-Guthaben +X), fehlender/leerer Vermerk → 400, Nicht-Admin → 403, Atomarität (Fehler in einer Zeile → beide zurückgerollt).

### B2e.4 — Backend: Aufladungs-Storno bucht Kasse zurück (§6.3)
**Aussage:** „Storno einer Aufladung macht die gekoppelte Kassen-Einzahlung rückgängig."
- Den Storno-Endpoint (B2d) erweitern: wenn das Original eine `AUFLADUNG_*`-Transaktion mit `kassenTransaktionId` ist, **zusätzlich** zur STORNO-Mitglieder-Zeile eine Gegen-`KassenTransaktion` anlegen: `typ=KORREKTUR`, gleiches `konto`/`verwalterId` wie die Original-Kassen-Zeile, `betragCent=-Original-Kassen-Betrag`, `notiz` = Pflicht (Verweis auf den Storno), `erstelltVonId=` Auslöser. Alles in **einer** DB-Transaktion.
- Greift nur beim **Admin**-Storno einer Aufladung (Mitglied-Selbst-Undo betrifft nur `KAUF` ohne Kassen-Kopplung).
- Tests: Admin storniert eine Bargeld-Aufladung → STORNO-Mitglieder-Zeile + Gegen-KORREKTUR-Kassen-Zeile, Mitglied-Guthaben zurück auf Vor-Aufladung, Verwalter-Topf zurück auf Vor-Aufladung.

### B2e.5 — Frontend: Admin-Bargeld-Aufladung
**Aussage:** „Verwalter trägt eine Bargeld-Aufladung für ein Mitglied ein."
- Einstieg im Admin-Bereich (Karte/Route, konsistent zum Bestand).
- Minimaler Member-Picker (Liste/Suche aus B2e.2). Formular: Betrag (€-Eingabe → Cent) + **Pflicht-Vermerk**.
- Absenden → Aufladungs-Call → Bestätigung, Mitglied-Guthaben aktualisiert.
- Kein Kassen-Screen (Töpfe/Box/Deckung) — das ist B2i. Hier nur das Eintragen.

---

## 4. Scope-Abgrenzung (bewusst NICHT in B2e)

- **Nur `EINZAHLUNG`/`VERWALTER`-Logik** — die anderen Kassen-Typen (`EINKAUF`, `ENTNAHME`, `EINLAGE_BOX`, `AUSLAGE`, `SPENDE`, `KORREKTUR` als eigene Aktion) und `konto=BOX` sind in der Konstante, aber **ohne Logik/UI** → **B2i**.
- **Kein Kassen-Screen** (Töpfe, Box, Gesamtbestand, Deckung) — **B2i**.
- **Keine Multi-Verwalter-Verteilung** — `verwalterId` = eingeloggter Admin. Lastverteilung + paypal.me-Pflege → **B2k**.
- **`isLeitung`/`paypalMeLink`** — nur Schema, **keine** Logik/UI → **B2j/B2k**.
- **Keine PayPal-Aufladung** — **B2f**.
- **Keine reiche Mitglieder-Übersicht / Guthaben-Korrektur** — **B2g**.
- **Keine Admin-Storno-UI** — B2e.4 ist Backend + Tests; die UI kommt **B2g**.
- **Keine Design-Politur** — **B5**.

---

## 5. Done-Kriterien (Browser-Test)

- [ ] Admin-Bereich → „Bargeld-Aufladung", Mitglied wählbar
- [ ] Betrag + Vermerk eingeben → Aufladung gebucht, Mitglied-Guthaben steigt um den Betrag
- [ ] Vermerk leer → Fehler (Pflicht)
- [ ] (Atomarität, Kassen-Zeile, Aufladungs-Storno-Rückbuchung: über die Test-Suite abgedeckt — Kassen-Screen existiert noch nicht)
- [ ] `pnpm test` grün

---

## 6. Sandbox-Hinweise

- Nach `db push`: Dev-Server neu (Prisma-Client). Additiv → kein `--accept-data-loss`.
- Kein `db:reset` (kaputt) — nur `db push` + `seed`.
- Kein `pkill`/`ps` — bei hängendem Prozess `docker restart claude-bwza-getraenke` (vom Mac).
- Dev: `cd app && pnpm dev` (Backend 4000, Vite 3001).

---

## 7. Commit-Ablauf am Ende (nach Lauras Freigabe)

Browser-Test → Freigabe → pro Sub-Commit als eigene Tool-Calls: `git add <files>` + `git status` + `git diff --cached` → `git commit` (ohne `Co-Authored-By`) → `git log -1`. Abschluss: `git log --oneline -N`. **Kein Push** — Laura pusht vom Mac.

**Granularitäts-Hinweis:** Falls zwei Sub-Commits dieselbe Datei teilen (z.B. `routes/buchen.ts` in B2e.3 und B2e.4, oder `schema.prisma`), das im Bündel-Bericht offenlegen und Laura die A/B-Entscheidung lassen (Hunk-Split vs. Zusammenführen) — **nicht** selbst entscheiden.

Danach `BERICHTE/PHASE_B2e_ABSCHLUSS.md` (lokal).
