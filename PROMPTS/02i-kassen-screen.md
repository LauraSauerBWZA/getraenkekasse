# Phase B2i — Kassen-Screen (Töpfe, Box, Deckung, Aktionen)

**Phase:** B2i. Logische Einheiten siehe §3 — **Commit-Granularität entscheidet Code selbst** und dokumentiert sie.
**Source of Truth:** `KONFIGURATION.md` **Update 8** — §6.8 (Kassenführung), §5.6 (KassenTransaktion), §7.6 (Kassen-Screen), §4 (Verwalter-Rechte), §8 (Primitives KassenBestandCard/KassenTransaktionRow/EinkaufSheet), §11.
**Voraussetzung:** B2g abgeschlossen (`origin/main = e9425ab`). `KassenTransaktion` voll im Schema (B2e.1), alle Typen in `kassen-typ`/`kassen-konto`. **Kein Schema-Change in B2i.**
**Modus:** Voll autonom — Code committet selbst, pusht nicht.

---

## 1. Arbeitsmodus (volle Autonomie, steht in CLAUDE.md)

Autonom bauen, keine Echtzeit-Rückfragen, Commit-Granularität selbst wählen + dokumentieren, selbst committen wenn Tests + Typecheck + Frontend-Build grün. STOPP nur bei echtem Blocker. **Kein `git push`** (Push = Laura). Bündel-Bericht mit echtem `git status` + `git log --oneline -N`. **Kein `Co-Authored-By`.**

---

## 2. Schritt 0 — Recherche (read-only)

Session-Start: `git status -sb` + `git log --oneline -4` (lokal, kein `git fetch` — Container-SSH-Eigenheit ignorieren). Bericht in `BERICHTE/PHASE_B2i_SCHRITT0.md` + 5–10 Zeilen. Prüfen:
1. **`KassenTransaktion`** im Schema — Felder, besonders `konto`, `verwalterId`, `einlageGegenId`, `typ`. Bestätigen, dass alle 7 Typen in `domain/kassen-typ.ts` und `VERWALTER`/`BOX` in `kassen-konto.ts` liegen.
2. **Bestehende Kassen-Buchungen** — wie B2e/B2f die gekoppelten `EINZAHLUNG`-Zeilen anlegen (`routes/aufladung.ts`), als Muster für die zweizeilige `EINLAGE_BOX`.
3. **`computeGuthabenCent`** + ob es eine Aggregat-Summe über alle Mitglieder gibt (für die Deckung).
4. **Admin-Frontend-Muster** (Karten/Routen) — wo der Kassen-Screen andockt (`🏦 Kasse`-Card + Route).
5. **Wie der eingeloggte Admin** als `verwalterId` ermittelt wird (analog B2e).

Kein `db push` erwartet. Kein echter Blocker → durchbauen.

---

## 3. Inhalt

### Backend — Kennzahlen + Historie

Alle live summiert (§6.8):
- **Verwalter-Topf je Verwalter** = `SUM(betragCent) WHERE konto=VERWALTER AND verwalterId=V`. Darf negativ.
- **Bar-Vereinskasse (Box)** = `SUM(betragCent) WHERE konto=BOX`.
- **Vereinsvermögen** = Summe aller Verwalter-Töpfe + Box = `SUM(alle KassenTransaktion.betragCent)`.
- **Deckung** = Vereinsvermögen − Summe aller Mitglieder-Guthaben = **`SUM(alle KassenTransaktion.betragCent) − SUM(alle Transaktion.betragCent)`**. Positiv = Puffer, negativ = Warnsignal.
- `GET` Kassen-Summary (`requireAdmin`): Töpfe (pro Verwalter mit Name), Box, Vereinsvermögen, Deckung, Summe Mitglieder-Guthaben.
- `GET` Kassen-Historie (`requireAdmin`): alle `KassenTransaktion` chronologisch (Typ, Konto, Verwalter-Name, Betrag, Vermerk, Datum).

### Backend — Aktionen (alle `requireAdmin`, `vermerk` **Pflicht**)

| Aktion | typ | konto | Betrag | Zeilen |
|---|---|---|---|---|
| Getränke-Einkauf | `EINKAUF` | VERWALTER (eigener) **oder** BOX | −X | 1 |
| Vereinsfremde Ausgabe | `ENTNAHME` | VERWALTER **oder** BOX | −X | 1 |
| Auslage (Privattasche) | `AUSLAGE` | VERWALTER (eigener) | −X (darf Topf negativ machen) | 1 |
| Spende / Gast | `SPENDE` | VERWALTER **oder** BOX | +X | 1 |
| Kassen-Korrektur | `KORREKTUR` | VERWALTER **oder** BOX | ±X | 1 |
| Geld in die Box legen | `EINLAGE_BOX` | VERWALTER −X **und** BOX +X | — | **2, gekoppelt** |

- Einzeilige Aktionen: eine `KassenTransaktion` mit `erstelltVonId=` Admin; bei `konto=VERWALTER` ist `verwalterId=` der eingeloggte Admin.
- **`EINLAGE_BOX`**: zwei Zeilen in **einer** `$transaction` (Muster wie die Aufladungs-Kopplung): `konto=VERWALTER, verwalterId=Admin, betragCent=-X` + `konto=BOX, betragCent=+X`, verknüpft über `einlageGegenId` (wechselseitig). Gesamtvermögen bleibt gleich.
- Betrag ganzzahlig, je nach Typ Vorzeichen-Regel (Einkauf/Entnahme/Auslage negativ-Effekt, Spende positiv, Korrektur ±). Eingabe sinnvoll validieren (≠ 0). `vermerk` leer/whitespace → `400`.
- REST-Form (ein generischer Endpoint mit `typ` oder mehrere) entscheidet Code.
- Tests: jede Aktion bewegt die richtigen Kennzahlen; `EINLAGE_BOX` lässt Vereinsvermögen unverändert (nur Aufteilung); fehlender Vermerk → 400; Nicht-Admin → 403; Deckung-Berechnung stimmt nach gemischten Buchungen.

### Frontend — Kassen-Screen (§7.6)

- **Bestands-Hero:** Vereinsvermögen groß.
- **Töpfe-Liste:** jeder Verwalter mit Stand (eigener hervorgehoben) + darunter Bar-Vereinskasse. (Aktuell ein Verwalter = du; pro `verwalterId` gebaut.)
- **Deckungs-Card:** Wert, **rot bei negativ**, mit kurzem Erklär-Text (Vereinsvermögen − was die Kasse den Mitgliedern schuldet).
- **Aktionen:** Einkauf, Entnahme, Einlage in die Box, Auslage, Spende, Korrektur — je ein Sheet mit Betrag, ggf. Konto-Wahl (mein Topf / Box), **Pflicht-Vermerk**.
- **Kassen-Historie:** chronologische Liste (Typ, Konto/Verwalter, Betrag, Vermerk, Datum).
- `lib/api.ts`: Summary, Historie, Aktions-Methoden.

---

## 4. Done-Kriterien (Lauras async Review)

- [ ] `🏦 Kasse` im Admin-Bereich → Hero (Vereinsvermögen), dein Verwalter-Topf + Bar-Vereinskasse, Deckungs-Card
- [ ] **Die bisherigen Bargeld-/PayPal-Aufladungen sind jetzt sichtbar** (Historie + im Topf) — das war bisher unsichtbar
- [ ] Einkauf (mein Topf, Vermerk) → Vereinsvermögen sinkt; Vermerk leer → Fehler
- [ ] Einlage in die Box → mein Topf sinkt, Box steigt, **Vereinsvermögen gleich**
- [ ] Auslage → mein Topf sinkt (darf negativ); Spende → steigt; Korrektur → ±
- [ ] Deckung plausibel, rot bei negativ
- [ ] `pnpm test` grün

---

## 5. Scope-Abgrenzung (bewusst NICHT in B2i)

- **Single-Verwalter** — Töpfe pro `verwalterId` gebaut, aber mehrere Verwalter ernennen + paypal.me-Pflege + Lastverteilung = **B2k**.
- **Keine Leitung-Read-only-Ansicht** der Kasse — **B2j**.
- **Keine Sortenstatistik** — **B3**.
- **Keine Design-Politur** — **B5**.
- **Kein Schema-Change.**

---

## 6. Sandbox-Hinweise

Kein `db push`. Kein `db:reset` (kaputt). Bei hängendem Prozess `docker restart claude-bwza-getraenke` (vom Mac). Dev: `cd app && pnpm dev`.

---

## 7. Abschluss (autonom, ohne Push)

Tests/Typecheck/Frontend-Build grün → Code committet selbst (Granularität dokumentiert; kein `Co-Authored-By`) → `BERICHTE/PHASE_B2i_BUENDEL.md` mit echtem `git status` + `git log --oneline -N` + Browser-Test-Anleitung → **STOPP ohne Push.** Laura reviewt, testet, pusht.
