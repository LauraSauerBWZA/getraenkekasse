# Phase B2b — Schritt 0: Recherche (Naming-Konsolidierung)

**Ziel der Phase B2b:** Die bekannten Naming-Inkonsistenzen aus Phase B1 bereinigen, bevor in B2c/ff. die Transaktions- und Kassen-Modelle dazukommen.

**Dieser Durchgang = NUR Schritt 0.** Lesen, analysieren, berichten. Kein Edit, kein Commit.

**Source of Truth:** `KONFIGURATION.md` (Update 8). Konventionen: `CLAUDE.md`.

---

## Kontext — die zwei Drifts

Laut `KONFIGURATION.md` Sektion 12 und dem B2a-Abschluss-Bericht gibt es zwei bekannte Inkonsistenzen:

1. **`InviteToken` → `Invite`**: Das Prisma-Modell heißt im B1-Code `InviteToken`, die Spec nennt es `Invite`. Reine Umbenennung.

2. **`User.guthaben` → ?**: Hier ist die Lage komplizierter. Der B1-Code hat ein `guthaben`-Feld (Int) auf `User`. Die API/Frontend nennt es `guthabenCent`.
   **ABER:** `KONFIGURATION.md` (Update 5+, Sektion 5.1 + 6.1) sagt ausdrücklich: **kein gespeichertes Guthaben-Feld** — Guthaben wird live aus Transaktionen summiert. Das eigentliche Streichen des Feldes kann aber erst passieren, wenn es Transaktionen gibt (Buchen-Flow = B2c).

**Das ist die zentrale Frage für Schritt 0:** Was davon gehört in B2b, was muss bis B2c warten?

---

## Recherche-Auftrag

Lies den relevanten Code und beantworte. Bericht in `BERICHTE/PHASE_B2b_SCHRITT0.md` (gitignored), plus Chat-Zusammenfassung.

### Teil A — InviteToken → Invite

1. **Wo überall** taucht `InviteToken` auf? Liste alle Stellen mit Datei + Zeile:
   - Prisma-Schema (`model InviteToken`, Relations-Felder auf `User`)
   - Backend (`prisma.inviteToken.*`-Aufrufe, Imports, Typen)
   - Tests
   - Sonstige (Kommentare, Variablennamen)
2. **Welche DB-Migration** ist nötig? SQLite-Dev-DB: Reicht `prisma db push` nach der Schema-Umbenennung, oder braucht es ein echtes Migrations-File? Was passiert mit bestehenden Daten (der eine Seed-Invite)? Ist Datenverlust akzeptabel (Dev-DB) oder muss migriert werden?
3. **Gibt es API-Verträge**, die sich durch die Umbenennung ändern? (Die Route heißt `/admin/invite` — bleibt die gleich? Das Response-Shape? Das sollte sich NICHT ändern, nur das interne Modell.)

### Teil B — guthaben / guthabenCent

4. **Wo überall** taucht `guthaben` (DB-Feld) und `guthabenCent` (API/Frontend) auf? Liste mit Datei + Zeile.
5. **Was wäre nötig**, um das Feld zu streichen und live zu summieren — und ist das in B2b überhaupt möglich, BEVOR es ein Transaktions-Modell gibt? (Vermutlich nein — dann muss B2b die Drift nur teilweise lösen.)
6. **Drei Handlungs-Optionen** abwägen und empfehlen:
   - **Option A:** In B2b nur `InviteToken → Invite` machen, `guthaben` komplett unangetastet lassen (kommt mit B2c, wenn Transaktionen da sind und das Feld eh wegfällt).
   - **Option B:** In B2b `guthaben` → `guthabenCent` umbenennen (DB-Spalte an API angleichen), das Streichen kommt später in B2c.
   - **Option C:** Beides in B2b — aber das Streichen geht ohne Transaktionen nicht, also faktisch wie B.
   Welche Option ist am saubersten und vermeidet Doppelarbeit? (Bedenke: wenn das Feld in B2c eh gestrichen wird, ist ein Umbenennen in B2b verschwendete Mühe.)

### Teil C — Allgemein

7. **Test-Status:** Läuft `pnpm test` (auth-flow.test.ts) aktuell durch? Welche Tests würden durch die Umbenennung brechen und müssten angepasst werden?
8. **Reihenfolge & Sub-Commit-Vorschlag:** Wie würdest du B2b in Sub-Commits zerlegen? (Vermutlich: Schema-Rename + Migration als ein Sub-Commit, Backend-Anpassung als nächster, Tests als letzter — oder anders, dein Vorschlag.)

---

## Was Schritt 0 liefern soll

`BERICHTE/PHASE_B2b_SCHRITT0.md` mit:
- Antworten auf die 8 Fragen, konkret mit Datei/Zeile
- **Klare Empfehlung** zur guthaben-Frage (Option A/B/C) mit Begründung
- Migrations-Strategie für die SQLite-Dev-DB (db push vs. Migration-File, Datenverlust ja/nein)
- Sub-Commit-Zerlegung
- Offene Fragen für Laura

Chat: 8-12 Zeilen Zusammenfassung mit der Kern-Empfehlung.

---

## Regeln (CLAUDE.md)

- **NUR LESEN.** Kein Edit, kein Schema-Change, kein Commit.
- Bei der guthaben-Frage nicht raten — analysieren, Optionen zeigen, empfehlen, Laura entscheiden lassen.
- Nach dem Bericht: STOPP.
