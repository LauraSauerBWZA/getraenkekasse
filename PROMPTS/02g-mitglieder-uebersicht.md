# Phase B2g — Mitglieder-Übersicht + Guthaben-Korrektur + Admin-Storno-UI

**Phase:** B2g. Logische Einheiten siehe §2 — **Commit-Granularität entscheidet Code selbst** (neuer Workflow) und dokumentiert sie im Bündel-Bericht.
**Source of Truth:** `KONFIGURATION.md` **Update 8** — §4 (Verwalter-Rechte), §6.1 (Live-Guthaben), §6.3 (Storno), §6.6 (negatives Guthaben), §7.2 (Admin-Bereich), §5.3 (`Transaktion`, `notiz`-Pflicht bei `KORREKTUR`/`STORNO`).
**Voraussetzung:** B2f abgeschlossen (`origin/main = 1b2fd5b`). Vorhanden und wiederzuverwenden: Mitglieder-Liste-Endpoint (B2e.2), Storno-Endpoint inkl. Aufladungs-Kassen-Rückbuchung (B2d/B2e.4), `computeGuthabenCent`.

---

## 1. Arbeitsmodus (volle Autonomie — gilt seit B2f, steht in CLAUDE.md)

- **Voll autonom bauen**, keine Echtzeit-Rückfragen. Code entscheidet Implementierung, Struktur, Naming, REST-Form, Validierung, Fehlertexte, Test-Aufbau **und Commit-Granularität** (dokumentieren).
- **Code committet sein Bündel selbst**, sobald Tests + Typecheck + (Frontend-)Build grün sind und der Bündel-Bericht steht.
- **STOPP nur bei echtem Blocker** (Spec-Widerspruch mit Folgen, fehlende Spec, neue Dependency, technische Sackgasse). Kleinere Mehrdeutigkeiten selbst lösen + dokumentieren.
- **HART: kein `git push`** — Push ist Lauras Aktion. Bündel-Bericht endet mit echtem `git status` + `git log --oneline -N` (Berichts-Skepsis). **Kein `Co-Authored-By`.**

---

## 2. Schritt 0 — Recherche (read-only)

Session-Start: `git status -sb` + `git log --oneline -4` (lokal — **kein** `git fetch` nötig; falls fetch in der Container-Session „Host key verification failed" wirft, ist das eine bekannte SSH-Kontext-Eigenheit, ignorieren — lokaler Stand zählt, Laura fetcht/pusht von ihrer Seite).

Bericht in `BERICHTE/PHASE_B2g_SCHRITT0.md` + 5–10 Zeilen. Prüfen:
1. **Bestehender Mitglieder-Liste-Endpoint** (B2e.2) — Pfad, Response-Form, ob er schon `guthabenCent` liefert. Wiederverwenden/erweitern statt neu bauen.
2. **Storno-Endpoint** (`routes/buchen.ts`) — Admin-Pfad mit Pflicht-Notiz + die `AUFLADUNG_*`-Kassen-Rückbuchung. Das Frontend ruft genau den.
3. **Transaktions-Daten pro Mitglied** — gibt es einen Endpoint, der die Transaktionen *eines* Users liefert? Falls nein → kommt in B2g (Detail).
4. **Admin-Frontend-Muster** (Karten/Routen, `/admin`) — wo Mitglieder-Übersicht + Detail andocken.
5. **`KORREKTUR`** in der `transaktion-typ`-Konstante vorhanden (aus B2c). Bestätigen.

Kein `db push` erwartet (keine Schema-Änderung — `KORREKTUR` ist schon im Modell). Kein echter Blocker → durchbauen.

---

## 3. Inhalt

### Backend

**Mitglied-Detail / Transaktionsliste:**
- `GET` Detail eines Mitglieds (`requireAdmin`): Stammdaten + live `guthabenCent` + Transaktionshistorie (jüngste zuerst) mit `typ`, `betragCent`, Drink-Name (bei `KAUF`), `notiz`, `createdAt`, und **ob bereits storniert** (für die UI: kein Doppel-Storno).
- Mitglieder-Übersicht: vorhandenen Liste-Endpoint nutzen/erweitern, sodass jede Zeile den Live-Saldo trägt.

**Manuelle Guthaben-Korrektur:**
- `POST` (`requireAdmin`): Body `{ userId, betragCent, notiz }`. `betragCent` ganzzahlig, **≠ 0**, darf negativ sein (Korrektur nach unten). `notiz` **Pflicht** (trim+length), sonst `400`.
- Legt **nur** eine Mitglieder-`Transaktion` an: `typ=KORREKTUR`, `betragCent=±X`, `notiz`, `userId=` Mitglied, `erstelltVonId=` Admin. **Keine** gekoppelte `KassenTransaktion** (bewusst — siehe §5).
- Antwort: neues `guthabenCent`.
- Tests: Korrektur rauf/runter, Live-Saldo stimmt, fehlende/leere Notiz → 400, Betrag 0 → 400, Nicht-Admin → 403.

**Storno:** kein neuer Backend-Code — der Endpoint aus B2d/B2e.4 wird vom Frontend genutzt.

### Frontend

- **Mitglieder-Übersicht** (`👥 Mitglieder` im Admin-Bereich, §7.2): Liste aller Mitglieder mit Name + Saldo, **negativ rot** (§6.6). Tap → Detail.
- **Mitglied-Detail:** Saldo groß (rot bei negativ), Transaktionshistorie (Typ, Betrag, ggf. Drink, Notiz, Datum; stornierte erkennbar).
- **Guthaben-Korrektur:** Aktion im Detail — Betrag (± in €) + **Pflicht-Notiz** → Korrektur buchen → Saldo + Historie aktualisiert.
- **Admin-Storno:** pro Transaktion in der Historie eine „Stornieren"-Aktion mit **Pflicht-Notiz**-Dialog → ruft den bestehenden Storno-Endpoint → Saldo + Historie aktualisiert. Bereits stornierte / Storno-Transaktionen sind nicht erneut stornierbar (UI + Backend).
- `lib/api.ts`: Methoden für Detail, Korrektur, Storno.

---

## 4. Done-Kriterien (Lauras async Review vor dem Push)

- [ ] Admin → Mitglieder: Liste mit Salden, negative rot
- [ ] Mitglied antippen → Detail mit Saldo + Transaktionshistorie
- [ ] Guthaben-Korrektur (rauf/runter) mit Pflicht-Notiz → Saldo ändert sich; Notiz leer → Fehler
- [ ] Admin storniert eine Transaktion des Mitglieds (mit Notiz) → Saldo passt sich an; bei einer Aufladung wird auch die Kasse zurückgebucht (über Tests/Detail nachvollziehbar)
- [ ] Bereits stornierte Transaktion nicht erneut stornierbar
- [ ] `pnpm test` grün

---

## 5. Scope-Abgrenzung (bewusst NICHT in B2g)

- **Guthaben-Korrektur erzeugt KEINE gekoppelte Kassen-Buchung** — nur Mitglieder-Ebene. Kopplung ist laut Spec aufladungs-spezifisch (§6.4/§6.5); eine Korrektur verändert bewusst die Deckung. Reales Geld bucht der Verwalter separat auf Kassen-Ebene (B2i). Konsistent mit „Buchen bewegt kein Kassengeld" + „App führt Buch, Verwalter erfüllt".
- **Kein Recht-Vergeben** (Verwalter/Leitung ernennen) — **B2j/B2k**.
- **Kein Kassen-Screen** (Töpfe/Box/Deckung) — **B2i**.
- **Keine Sortenstatistik** — **B3**.
- **Keine Design-Politur** — **B5**.

---

## 6. Sandbox-Hinweise

Kein `db push` erwartet. Kein `db:reset` (kaputt). Bei hängendem Prozess `docker restart claude-bwza-getraenke` (vom Mac). Dev: `cd app && pnpm dev`.

---

## 7. Abschluss (autonom, ohne Push)

Tests/Typecheck/(Frontend-)Build grün → Code committet die Sub-Commits selbst (Granularität dokumentiert; kein `Co-Authored-By`) → `BERICHTE/PHASE_B2g_BUENDEL.md` mit echtem `git status` + `git log --oneline -N` + Browser-Test-Anleitung → **STOPP ohne Push.** Laura reviewt, testet, pusht.
