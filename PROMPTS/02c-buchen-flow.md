# Phase B2c — Buchen-Flow + Live-Guthaben (das Herzstück)

**Phase:** B2c. Sub-Commits **B2c.1 – B2c.4**.
**Source of Truth:** `KONFIGURATION.md` **Update 8** — besonders §5.3 (Transaktion), §6.1 (Live-Guthaben), §6.2 (Buchen-Flow), §6.6 (negatives Guthaben), §7.1 (Bottom-Nav), §11/§12 (Verbotenes / Inkonsistenzen).
**Voraussetzung:** B2b abgeschlossen (`Drink`-Modell + Katalog + Seed liegen auf `origin/main`, Stand `496f0eb`).
**Modus:** Autarke Bauphase, ein gebündelter STOPP am Ende.

---

## 0. Session-Start & Lese-Pflicht

**Zuerst — echten Branch-State aus Git ableiten, nicht aus dem Memory glauben** (Lehre aus B2b: das State-File driftet):
```
git fetch origin
git status -sb
git log --oneline -4
```
Erwartet: `## main...origin/main` ohne `[ahead]`, HEAD = `496f0eb`. Falls abweichend: im Schritt-0-Bericht notieren, nicht raten. Das State-Memory danach an diesem verifizierten Stand ausrichten, nicht an einer Erzählung.

**Lese-Pflicht (in dieser Reihenfolge):**
1. `CLAUDE.md`
2. `KONFIGURATION.md` (Update 8) — §5.3, §6.1, §6.2, §6.6, §7.1, §11, §12
3. Diese Datei

`archiv/` ist **nicht** als Quelle zu verwenden.

---

## 1. Arbeitsmodus (gilt weiter)

Code **entscheidet selbst:** interne Implementierung, Komponenten-/Datei-Struktur, Naming, REST-Detailform, Validierung, Fehlertexte, Test-Aufbau, Styling im Rahmen der Tokens, Route-Namen für die neuen Endpoints.

Code macht **nur bei echtem Blocker** STOPP: Widerspruch zur `KONFIGURATION.md`, fehlende Spec, **neue Dependency**, technische Sackgasse.

**Unverändert (harte Regeln):** Kein `git commit` ohne Lauras Freigabe · vor Commit `git status` **und** `git diff --cached` als eigener Tool-Call · kein `git push` aus der Sandbox · kein `Co-Authored-By`-Trailer.

---

## 2. Schritt 0 — Recherche (read-only, kein Edit)

Bericht in `BERICHTE/PHASE_B2c_SCHRITT0.md` + 5–10 Zeilen im Chat. Prüfe:

1. **Aktuelles Schema** — `User` (mit `guthaben`-Feld), `Drink`, `Invite`, `Session`. Wie heißt das Guthaben-Feld exakt, welcher Typ/Default?
2. **Streichpfad `guthaben` (kritisch)** — finde **jede** Stelle, die `guthaben` / `guthabenCent` liest oder schreibt: `/auth/me`-Response, `Dashboard.tsx`, `lib/api.ts`-Typen, Admin-Views, Seed, Tests. Liste sie vollständig im Bericht. Das ist die Grundlage dafür, dass das Streichen nichts bricht.
3. **Member-API-Muster** — gibt es einen nicht-admin-gegateten Router für eingeloggte Mitglieder, oder hängt alles an `/auth` und `/admin`? Wo docken `GET aktive Drinks` (member) und `POST Buchung` sauber an?
4. **Frontend-Navigation** — welche Routes/Tabs existieren (nur Dashboard? Bottom-Nav schon da?)? Wo lebt der Buchen-Screen, konsistent zum Bestand (analog zur Art, wie der Admin-Bereich angedockt wurde)?
5. **Enum-Linie** — `drink-kategorien.ts` (String+Zod) als Vorlage für `transaktion-typ.ts` bestätigen.
6. **Test-Setup** — die B2b-Lehre gilt: vitest `singleFork`+`isolate` → `process.env`-Race bei mehreren Test-Files. Buchungs-Tests entsprechend platzieren (Code entscheidet: in `auth-flow.test.ts` integrieren oder sauberes `globalSetup` einführen).
7. **`db push` Spaltenlöschung** — das Entfernen von `User.guthaben` ist destruktiv. Prüfe, ob `pnpm exec prisma db push` im nicht-interaktiven Container-Shell dafür `--accept-data-loss` braucht. (Akzeptabel: es gibt keine Produktionsdaten, Guthaben wird ab jetzt berechnet.)

**Wenn Schritt 0 keinen echten Blocker zutage fördert: direkt durchbauen.**

---

## 3. Sub-Commits

### B2c.1 — `Transaktion`-Modell ins Schema + `typ`-Konstante

**Aussage:** „Transaktion-Modell in Prisma-Schema aufnehmen."

Modell **voll nach §5.3**, mit **einer Ausnahme**:

| Feld | Typ | Notiz |
|---|---|---|
| `id` | String cuid | |
| `userId` | String, FK → User | |
| `typ` | String | Werte über Konstante: `KAUF`, `AUFLADUNG_PAYPAL`, `AUFLADUNG_BARGELD`, `KORREKTUR`, `STORNO` — **alle** von Anfang an in der Konstante, auch wenn B2c nur `KAUF` nutzt (spätere Phasen erben sie ohne Migration) |
| `betragCent` | Int | negativ bei `KAUF` |
| `drinkId` | String, FK → Drink, nullable | nur bei `KAUF` |
| `preisAtKaufCent` | Int, nullable | eingefroren bei `KAUF` |
| `stornoVonId` | String, FK → Transaktion, nullable (reflexiv) | jetzt schon anlegen — kostet nichts, B2d nutzt es |
| `notiz` | String, nullable | bei `KAUF` null |
| `erstelltVonId` | String, FK → User | bei Selbstbuchung = der User selbst |
| `createdAt` | DateTime | |

**Bewusst NICHT jetzt:** `kassenTransaktionId` (FK → `KassenTransaktion`). Die Ziel-Entität existiert erst ab **B2e** — die Kopplung wird dort ergänzt. Würde man sie jetzt anlegen, scheitert `db push` an der unbekannten Relation.

- Neue Konstante `app/backend/src/domain/transaktion-typ.ts` analog `drink-kategorien.ts` (`TRANSAKTION_TYPEN as const`, Typ, `z.enum`).
- Indizes auf FKs (`@@index([userId])` etc.) wie im Bestand.
- `pnpm exec prisma db push`, danach **Dev-Server neu** (Prisma-Client).

### B2c.2 — `User.guthaben` streichen → Live-Guthaben

**Aussage:** „Guthaben live aus Transaktionen summieren statt speichern."

- `guthaben`-Feld aus `User` im Schema entfernen. `db push` (ggf. `--accept-data-loss`, siehe Schritt 0.7). Dev-Server neu.
- Backend-Helper, der das Guthaben eines Users berechnet: `SUM(transaktionen.betragCent) WHERE userId = X` (§6.1). Zentrale, wiederverwendbare Funktion.
- Alle in Schritt 0.2 gefundenen Lese-Stellen auf den Helper umstellen.
- **API-Contract bleibt:** das Feld heißt nach außen weiter `guthabenCent` (z.B. in `/auth/me`), nur die Quelle wechselt von gespeichert zu live-summiert. So bleibt das Frontend idealerweise unangetastet.
- Tests, die `guthaben` annahmen, auf den neuen Pfad anpassen.

Nach diesem Sub-Commit zeigt das Dashboard ein korrektes (aktuell überall 0, weil noch keine Buchung) Live-Guthaben — und nichts ist kaputt. Das ist der Test eines sauberen Sub-Commits.

### B2c.3 — Backend: Member-Drinks + Buchung + Tests

**Aussage:** „Buchungs-Endpoint legt eine KAUF-Transaktion an, Member-Endpoint liefert aktive Drinks."

- `GET` aktive Drinks für Mitglieder: nur `isActive=true`, hinter `requireAuth` (nicht admin-gegated). Gruppierung kann Frontend machen — Backend liefert flache, sortierte Liste.
- `POST` Buchung (Route-Name entscheidest du): Body `{ drinkId }`. Server:
  - Drink laden, muss existieren **und** `isActive` sein (sonst `404`/`400`)
  - `Transaktion` anlegen: `typ=KAUF`, `userId=` aktueller User, `erstelltVonId=` aktueller User, `drinkId`, `preisAtKaufCent = drink.preisCent` (**eingefroren**), `betragCent = -drink.preisCent`
  - Antwort: die neue Transaktion **und** das neu berechnete Guthaben (`guthabenCent`)
- **Nur Selbstbuchung** in B2c. Buchen für andere / Admin-Korrektur ist B2g, nicht hier.
- Negatives Guthaben blockiert **nicht** (§6.6) — die Buchung geht immer durch.
- Tests: Auth-Gate, erfolgreiche Buchung, Preis-Einfrieren (Buchung behält Preis auch nach Drink-Preisänderung), inaktiver/unbekannter Drink → Fehler, Guthaben-Berechnung nach mehreren Buchungen.

### B2c.4 — Frontend: Buchen-Flow

**Aussage:** „Mitglied bucht ein Getränk über Auswahl + Confirm und sieht das Guthaben sofort sinken."

- Buchen-Screen (Route/Tab konsistent zum Bestand). Aktive Drinks **nach Kategorie gruppiert** (§6.2, §7.1) — `DrinkPicker`.
- Tap auf Drink → **Confirm-Sheet** (§6.2): Drink-Name, Icon, Preis, **neues Guthaben** (aktuelles − Preis). Bei negativem Ergebnis: rote Warnung „Du gehst auf −X,XX € — trotzdem buchen?" (§6.6). **Kein** Audio, **kein** Hard-Stop (§11).
- Bestätigen → Buchungs-Call → Confirm schließt → Guthaben-Anzeige sofort aktualisiert.
- `lib/api.ts`: Member-Drinks-Methode + Buchungs-Methode + ggf. neue Typen.

---

## 4. Scope-Abgrenzung (bewusst NICHT in B2c)

- **Kein Storno** (5-Min-Aktion + Endpoint) — **B2d**. (`stornoVonId` ist im Modell, aber keine Storno-Logik.)
- **Keine Aufladungen** (Bargeld/PayPal) — **B2e/B2f**. (Die `typ`-Werte sind in der Konstante, aber ungenutzt.)
- **Kein `kassenTransaktionId`** im Modell — kommt mit `KassenTransaktion` in **B2e**.
- **Kein Verlauf-Screen / Trinkjournal / Achievements** — **B4**. (Die Buchung ist über das sinkende Guthaben + API verifizierbar.)
- **Keine Sortenstatistik** — **B3**.
- **Kein Buchen für andere** — nur Selbstbuchung.
- **Keine Design-Politur, keine volle Bottom-Nav-Ausarbeitung** — **B5**. Funktionales Routing reicht.

---

## 5. Done-Kriterien (Browser-Test am Phasenende)

- [ ] Buchen-Screen erreichbar, zeigt aktive Drinks nach Kategorie (inaktive **nicht** sichtbar für Mitglieder)
- [ ] Drink antippen → Confirm-Sheet mit Name, Icon, Preis, neuem Guthaben
- [ ] Bestätigen → Guthaben sinkt sofort um den Preis
- [ ] Negativ-Fall: Buchung möglich, rote Warnung im Confirm, kein Sound, kein Block
- [ ] Preis-Einfrieren: nach einer Buchung den Drink-Preis im Admin ändern → die getätigte Buchung behält ihren Preis (per API / DB prüfen, Verlauf-Screen existiert noch nicht)
- [ ] `User.guthaben`-Feld ist weg, Dashboard zeigt korrektes Live-Guthaben, nichts kaputt
- [ ] `pnpm test` grün

---

## 6. Sandbox-Hinweise

- Nach **jedem** `db push` (zwei in dieser Phase): Dev-Server neu starten, sonst alter Prisma-Client.
- Spalten-Drop (`guthaben`) braucht ggf. `prisma db push --accept-data-loss` — okay, keine Produktionsdaten.
- `db:reset` ist kaputt (preexisting) — nicht verwenden, nur `db push` + `seed`.
- Kein `pkill`/`ps` im Container — bei hängendem Prozess: `docker restart claude-bwza-getraenke` (vom Mac).
- Dev: `cd app && pnpm dev` (Backend 4000, Vite 3001).

---

## 7. Commit-Ablauf am Ende (nach Lauras Freigabe)

Browser-Test mit Laura → Freigabe → pro Sub-Commit als eigene Tool-Calls: `git add <files>` + `git status` + `git diff --cached` → `git commit` (ohne `Co-Authored-By`) → `git log -1`. Abschluss: `git log --oneline -N`. **Kein Push** — Laura pusht vom Mac.

**Hinweis zur Sub-Commit-Granularität:** Falls B2c.4 in einer einzigen Buchen-Flow-Datei landet (wie `AdminDrinks.tsx` in B2b), gilt der gleiche Fall — eine zusammenhängende Datei = ein Commit ist sauberer als ein künstlicher Split. Das ist Lauras Entscheidung beim Commit-Lauf; Vorschlag im Bündel-Bericht machen, nicht selbst entscheiden.

Danach `BERICHTE/PHASE_B2c_ABSCHLUSS.md` (lokal, nicht im Git) mit Commit-Hashes.
