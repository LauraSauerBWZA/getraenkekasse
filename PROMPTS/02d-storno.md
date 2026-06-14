# Phase B2d — Storno-Flow (5-Min Mitglied, jederzeit Admin)

**Phase:** B2d. Sub-Commits **B2d.1 – B2d.2**.
**Source of Truth:** `KONFIGURATION.md` **Update 8** — besonders §6.3 (Storno-Flow), §4 (Rechte), §5.3 (Transaktion / `notiz`-Pflicht), §11 (Verbotenes: keine Storno-Stornos).
**Voraussetzung:** B2c abgeschlossen. `Transaktion`-Modell inkl. `stornoVonId` (reflexiv) liegt bereits — **kein Schema-Change in dieser Phase.**
**Modus:** Autarke Bauphase, ein gebündelter STOPP am Ende.

---

## 0. Session-Start & Lese-Pflicht

Echten Branch-State aus Git ableiten (nicht aus dem Memory):
```
git fetch origin
git status -sb
git log --oneline -4
```
Erwartet: `## main...origin/main` ohne `[ahead]`, HEAD = aktueller `origin/main` (nach dem PROMPTS-chore-Push). Untracked `PROMPTS/*.md` sind harmlos — nicht anfassen außer der neuen `02d-storno.md`. Abweichung im Schritt-0-Bericht notieren, nicht raten.

**Lese-Pflicht:** 1) `CLAUDE.md` · 2) `KONFIGURATION.md` (Update 8) §6.3, §4, §5.3, §11 · 3) diese Datei. `archiv/` ist nicht Quelle.

---

## 1. Arbeitsmodus (gilt weiter)

Code entscheidet selbst: Implementierung, Struktur, Naming, REST-Detailform, Validierung, Fehlertexte (inkl. der genauen Auto-Notiz-Formulierung), Test-Aufbau, das minimale Undo-UI-Pattern.

STOPP nur bei echtem Blocker: Spec-Widerspruch, fehlende Spec, neue Dependency, technische Sackgasse.

**Unverändert (harte Regeln):** Kein `git commit` ohne Lauras Freigabe · vor Commit `git status` **und** `git diff --cached` als eigener Tool-Call · kein `git push` aus der Sandbox · kein `Co-Authored-By`.

---

## 2. Schritt 0 — Recherche (read-only)

Bericht in `BERICHTE/PHASE_B2d_SCHRITT0.md` + 5–10 Zeilen im Chat. Prüfe:

1. **Buchungs-Endpoint aus B2c** (`routes/buchen.ts`) — Struktur, wie die `KAUF`-Transaktion angelegt wird, Response-Form.
2. **Guthaben-Helper** (`domain/guthaben.ts`) — bestätigen, dass die Live-Summe eine STORNO-Zeile automatisch verrechnet (kein zusätzlicher Saldo-Code nötig).
3. **`erstelltVonId` / `userId`-Semantik** der bestehenden Transaktionen — damit die STORNO-Zeile korrekt zugeordnet wird (`userId` = Betroffener, `erstelltVonId` = Auslöser).
4. **Member-Surface für den Undo** — wo eine eingeloggte Person nach dem Buchen ihre letzte Buchung sieht (aktuell kein Verlauf-Screen). Welche minimale Stelle (z.B. „letzte Buchung"-Karte auf dem Buchen-Screen oder Dashboard) passt zum Bestand? Code entscheidet das Pattern.
5. **Test-Setup** — der `memberAgent`/`adminAgent`-Aufbau aus `auth-flow.test.ts` (B2c). Storno-Tests dort andocken.

Kein echter Blocker erwartet → direkt durchbauen.

---

## 3. Storno-Logik (Spec §6.3 / §4 / §5.3 / §11)

Eine STORNO-Transaktion ist eine neue `Transaktion`-Zeile:
- `typ = STORNO`
- `stornoVonId = <Original.id>`
- `betragCent = -Original.betragCent` (kehrt den Original-Betrag um)
- `userId = Original.userId` (derselbe Betroffene)
- `erstelltVonId = <Auslöser>` (Mitglied oder Admin)
- `notiz` = **Pflicht** (siehe Regeln unten)

**Das Live-Guthaben (§6.1) verrechnet das automatisch** — keine separate Saldo-Logik.

**Regeln:**

| Auslöser | Bedingung | Notiz |
|---|---|---|
| **Mitglied** | nur **eigene** `KAUF`-Transaktion, **innerhalb 5 Min** nach `createdAt` | **Auto-Notiz** gesetzt (z.B. „Storno durch Mitglied, 5-Min-Fenster") — kein Dialog |
| **Admin** | **jede** Transaktion, **jederzeit** | **Pflicht** — Admin gibt sie ein, fehlt sie → `400` |

- Konstante **`STORNO_FENSTER_MINUTEN = 5`** fix im Code.
- **Kein Storno eines Stornos** (§11) → STORNO-Transaktionen sind nicht stornierbar, `400`/`403`.
- **Kein Doppel-Storno** → existiert bereits eine STORNO-Zeile mit `stornoVonId = X`, ist X nicht erneut stornierbar.
- Mitglied außerhalb des Fensters / fremde Transaktion → `403` (nur Admin kann dann).

**Aufladungs-Storno mit Kassen-Rückbuchung (§6.3 Absatz 3): NICHT in B2d.** Es gibt noch keine `AUFLADUNG`-Transaktionen und keine `KassenTransaktion` (kommen B2e/B2f). Die Storno-Logik soll erweiterbar bleiben, aber die gekoppelte Kassen-Rückbuchung wird **dort** ergänzt, nicht hier.

---

## 4. Sub-Commits

### B2d.1 — Backend: Storno-Endpoint + Logik + Tests
**Aussage:** „Storno-Endpoint kehrt eine Transaktion regelkonform um."
- Endpoint (Route-Name entscheidest du, z.B. `POST /transaktionen/:id/storno`), hinter `requireAuth`.
- Rollen-Logik wie §3: Mitglied (eigene `KAUF`, Fenster, Auto-Notiz) vs. Admin (alles, jederzeit, Pflicht-Notiz aus Body).
- Schutz: kein Storno-of-Storno, kein Doppel-Storno, Fenster-/Ownership-Checks.
- Antwort: die STORNO-Transaktion + neu berechnetes `guthabenCent`.
- **Kein Schema-Change**, kein `db push`.
- Tests: Mitglied im Fenster ✓, Mitglied nach Fenster → 403, fremde Transaktion → 403, Admin jederzeit ✓, Admin ohne Notiz → 400, Storno-of-Storno → Fehler, Doppel-Storno → Fehler, Auto-Notiz beim Mitglied gesetzt, Guthaben nach Storno wieder auf Ausgangswert.

### B2d.2 — Frontend: Mitglied-Undo im 5-Min-Fenster
**Aussage:** „Mitglied macht eine eigene Buchung im 5-Min-Fenster rückgängig."
- Minimale Surface (Pattern aus Schritt 0): letzte eigene Buchung(en) mit „Rückgängig"-Affordance, **nur sichtbar/aktiv innerhalb des Fensters** (nach Ablauf ausgeblendet/deaktiviert).
- Tap → Storno-Call → Guthaben sofort wieder hoch, Buchung als storniert erkennbar.
- `lib/api.ts`: Storno-Methode.
- Kein Dialog, keine Notiz-Eingabe beim Mitglied (Auto-Notiz im Backend).

---

## 5. Scope-Abgrenzung (bewusst NICHT in B2d)

- **Keine Admin-Storno-UI** — der Endpoint kann Admin-Storno (getestet), aber die Oberfläche zum Stornieren fremder/alter Transaktionen gehört zur Mitglieder-/Transaktionsübersicht in **B2g**. Kein Wegwerf-UI in B2d.
- **Keine Aufladungs-/Kassen-Rückbuchung** — B2e/B2f.
- **Kein Verlauf-Screen / Trinkjournal** — B4.
- **Kein Schema-Change.**
- **Keine Design-Politur** — B5.

---

## 6. Done-Kriterien (Browser-Test)

- [ ] Nach einer Buchung erscheint die „Rückgängig"-Möglichkeit für die eigene Buchung
- [ ] Rückgängig → Guthaben sofort wieder auf dem Stand vor der Buchung
- [ ] Nach Ablauf des 5-Min-Fensters ist der Undo für das Mitglied weg/deaktiviert
- [ ] (Admin-Storno: keine UI, über die Test-Suite abgedeckt)
- [ ] `pnpm test` grün

---

## 7. Sandbox-Hinweise

Kein `db push` in dieser Phase. Dev: `cd app && pnpm dev` (Backend 4000, Vite 3001). Bei hängendem Prozess: `docker restart claude-bwza-getraenke` (vom Mac, kein `pkill`/`ps` im Container).

---

## 8. Commit-Ablauf am Ende (nach Lauras Freigabe)

Browser-Test → Freigabe → pro Sub-Commit als eigene Tool-Calls: `git add <files>` + `git status` + `git diff --cached` → `git commit` (ohne `Co-Authored-By`) → `git log -1`. Abschluss: `git log --oneline -N`. **Kein Push** — Laura pusht vom Mac. Danach `BERICHTE/PHASE_B2d_ABSCHLUSS.md` (lokal).
