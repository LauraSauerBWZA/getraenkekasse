# Account-A — Mitglied entfernen + Konto-Selbstlöschung + Datenexport

**Phase:** Account-A (erste Hälfte des Account-Blocks; Account-B = Passwort-Reset + Invite-als-Admin folgt). Logische Einheiten siehe §3 — **Granularität entscheidet Code selbst** und dokumentiert sie.
**Source of Truth:** `KONFIGURATION.md` — §4 (Rollen), §5.1 (`User.deletedAt` existiert), §6.7 (Account-Lifecycle), §9 (Datenexport-Regel), §11 (keine Aufbewahrung gelöschter User-Transaktionen für Statistik).
**Voraussetzung:** Visual-Redirection durch. `User.deletedAt` liegt im Schema (B2e). **Erwartung: kein Schema-Change** (Ausschluss läuft über die User-Relation). Falls Code wider Erwarten einen für nötig hält → STOPP + im Schritt-0 begründen.
**Modus:** Voll autonom — Code committet selbst, pusht nicht. Kein `Co-Authored-By`.

> **DSGVO-Kontext:** Das volle DSGVO-Paket (DSE/AVV/VVZ) ist gestrichen (internes Tool). Löschen + Export bauen wir als **nützliche Funktionen**, nicht als Compliance. Der 30-Tage-**Hard-Delete-Job** ist **out of scope** (Soft-Delete genügt intern) — optional später.

---

## 1. Arbeitsmodus

Autonom, selbst committen wenn Tests + Typecheck + Frontend-Build grün. STOPP nur bei echtem Blocker (z.B. unerwarteter Schema-Bedarf). **Kein `git push`.** Bündel mit echtem `git status` + `git log`. Kein `Co-Authored-By`.

---

## 2. Schritt 0 — Recherche (read-only)

`git status -sb` + `git log --oneline -4` (lokal, kein `fetch`). Bericht → `BERICHTE/ACCOUNT_A_SCHRITT0.md` + 5–10 Zeilen. Prüfen:
1. **Login/Auth:** lehnt der Login-/`requireAuth`-Pfad **soft-deletete User** (`deletedAt != null`) schon ab? Falls **nicht** → muss in dieser Phase ergänzt werden (sonst sperrt das Löschen niemanden aus).
2. **`GET /admin/users`** (B2e): zeigt aktive User — bestätigen, dass deletedAt schon gefiltert wird.
3. **Kassen-Kopplung:** wie `Transaktion.kassenTransaktionId` ↔ `KassenTransaktion` verknüpft ist (für das Entkoppeln beim Löschen, §6.7).
4. **Aggregate, die deletedAt berücksichtigen müssen:** Mitglieder-Guthaben-Summe + Deckung (`kasse`-Summary, B2i) und **Sortenstatistik** (B3) — zählen die aktuell *alle* Transaktionen, auch von (künftig) gelöschten Usern? → müssen gelöschte User **ausschließen** (§11).
5. **Last-Admin-Schutz** (B2k) — wiederverwendbar, falls ein zu löschender User Admin ist.
6. **Eigene Transaktions-Historie** (`GET /me/transaktionen`, B4) + Drink-Namen — Basis für den Export.
7. **Profil-Einstieg:** wo Member-Aktionen andocken (Profil-Drawer aus B5a; AdminProfil aus B2k).

Kein `db push` erwartet → durchbauen.

---

## 3. Inhalt

### 3.1 Soft-Delete-Kern (geteilt)

Eine Soft-Delete-Operation auf einen User (von Admin **oder** vom User selbst), die konsistent:
- `User.deletedAt = now()` setzt → **kein Login mehr** (Auth-Pfad muss deletedAt ablehnen; falls noch nicht → ergänzen).
- **Kassen-Kopplung erhält:** gekoppelte `KassenTransaktion`-Einträge des Users **bleiben** (Geld war real in der Kasse), aber `Transaktion.kassenTransaktionId` wird auf **null** gesetzt (entkoppeln, §6.7) — der Kassenbestand bleibt unverfälscht.
- **Aggregat-Ausschluss (§11):** gelöschte User fließen **nicht** mehr in Sortenstatistik, Mitglieder-Guthaben-Summe und Deckung ein (Ausschluss über die User-Relation/`deletedAt` — **kein** `Transaktion.deletedAt`-Feld, kein Schema-Change).
- **Effekt auf Deckung (gewollt):** fällt die Verbindlichkeit eines Mitglieds weg, während die Kasse das Geld behält, steigt die Deckung — korrekt (Restguthaben wird außerhalb der App geklärt, §6.7).

### 3.2 Mitglied entfernen (Admin)

- Endpoint (Form Code-Wahl, z.B. `DELETE /admin/users/:id`), `requireAdmin` → Soft-Delete-Kern.
- **Ist der User Admin:** Last-Admin-Schutz greift (B2k) — der letzte aktive Admin kann nicht entfernt werden (400). Hat der zu löschende Admin einen Verwalter-Topf ≠ 0, **warnen** (Prozess-Hinweis „Topf vorher ausgleichen/übergeben") — **nicht** hart blockieren (§6.7).
- **Frontend:** im Mitglied-Detail (B2g) Aktion „Mitglied entfernen" mit **klarer Bestätigung** (destruktiv). Danach verschwindet das Mitglied aus der aktiven Liste.

### 3.3 Konto-Selbstlöschung (Mitglied)

- Endpoint (z.B. `DELETE /me`), `requireAuth` → Soft-Delete-Kern auf den **eigenen** User, danach Session beenden/Logout.
- **Frontend:** im Profil-Drawer (B5a) Aktion „Konto löschen" mit **klarer Bestätigung** (destruktiv, Hinweis „Restguthaben mit dem Verwalter klären").

### 3.4 Datenexport (Mitglied, §9)

- `GET /me/export` (o.ä.), `requireAuth`, eigene Daten → **JSON**:
  - Profil (Name, Email, Rollen, `createdAt`)
  - **eigene** Transaktionen inkl. Drink-Name (§9: eigene Buchungen mit Sorte = ja)
  - eigene Aufladungs-Anfragen
  - **NICHT:** fremde Daten, aggregierte App-Statistiken, Kassen-Daten (§9)
- **Frontend:** im Profil-Drawer „Meine Daten exportieren" → lädt eine JSON-Datei herunter.

### Tests
- Soft-deleteter User kann sich **nicht** mehr einloggen.
- Admin-Entfernen setzt `deletedAt`, **entkoppelt** Kasse (KassenTransaktion bleibt, `kassenTransaktionId`=null), Bestand unverändert.
- Gelöschte User **raus** aus Sortenstatistik + Mitglieder-Guthaben-Summe + Deckung; Deckung verschiebt sich korrekt.
- Last-Admin kann nicht entfernt werden (400); Nicht-Admin auf Admin-Endpoint → 403.
- Selbstlöschung setzt eigenes `deletedAt` + beendet Session.
- Export liefert **nur eigene** Daten (kein fremder/aggregierter/Kassen-Bezug).

### Bewusst NICHT in Account-A
- **Admin-Passwort-Reset + Invite-als-Admin/Leitung** → **Account-B**.
- **30-Tage-Hard-Delete-Job** → optional/später, nicht hier.
- **Kein Schema-Change** (Ausschluss via User-Relation).

---

## 4. Done-Kriterien (Lauras async Review)

- [ ] Admin kann im Mitglied-Detail ein **Mitglied entfernen** (mit Bestätigung); es verschwindet aus der aktiven Liste und kann sich nicht mehr einloggen
- [ ] Mitglied kann sein **eigenes Konto löschen** (Drawer, mit Bestätigung) → ausgeloggt, kein Login mehr
- [ ] **Datenexport** (Drawer) lädt eigene Daten als JSON; keine fremden/aggregierten/Kassen-Daten
- [ ] Kassenbestand bleibt nach einer Löschung korrekt (Kasse entkoppelt, nicht verfälscht); Deckung verschiebt sich plausibel
- [ ] Gelöschte User nicht mehr in Sortenstatistik / Mitglieder-Summe / Deckung
- [ ] Letzter Admin nicht löschbar
- [ ] `pnpm --filter backend test` grün, Frontend-`build` grün

---

## 5. Sandbox-/Test-Hinweise

- Kein `db:reset` (kaputt). `db push` nur falls (wider Erwarten) ein Schema-Change nötig wäre — dann vorher STOPP. Bei stale: `docker restart claude-bwza-getraenke` (Mac). Dev: `cd app && pnpm dev`.
- **Browser-Test:** ein Test-Mitglied im Detail entfernen → weg aus der Liste, Login schlägt fehl. Vorher ein paar Buchungen dieses Mitglieds anlegen → nach dem Entfernen: Sortenstatistik + Deckung passen sich an, Kassenbestand bleibt stabil. Selbstlöschung über den Drawer (zweiter Account). Export-JSON öffnen und prüfen, dass nur eigene Daten drin sind.

---

## 6. Abschluss (autonom, ohne Push)

Tests/Typecheck/Frontend-Build grün → Code committet selbst (Granularität dokumentiert; kein `Co-Authored-By`) → `BERICHTE/ACCOUNT_A_BUENDEL.md` mit echtem `git status` + `git log --oneline -N` + Browser-Test-Anleitung → **STOPP ohne Push.** Laura reviewt, testet, pusht.
