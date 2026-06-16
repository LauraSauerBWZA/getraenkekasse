# Account-B — Admin-Passwort-Reset + Invite-als-Admin/Leitung + KONFIGURATION-Doku-Fix

**Phase:** Account-B (zweite Hälfte des Account-Blocks). Logische Einheiten siehe §3 — **Granularität entscheidet Code selbst** und dokumentiert sie.
**Source of Truth:** `KONFIGURATION.md` — §3/§4 (Rollen, Verwalter/Leitung ernennbar), §5.4 (`Invite` hat `isAdmin`/`isLeitung`), Magic-Link-Mechanik aus B1/B2a.
**Voraussetzung:** Account-A gepusht. Kein Email-Versand (Resend gestrichen) — **Reset-Link wird angezeigt, Admin leitet ihn selbst weiter** (genau wie der Invite-Link in B2a.3).
**Modus:** Voll autonom — Code committet selbst, pusht nicht. Kein `Co-Authored-By`.

> **Schema-Hinweis:** Der Passwort-Reset *könnte* eine Schema-/Token-Frage aufwerfen. **Bevorzugt:** die bestehende Magic-Link-/Token-Mechanik wiederverwenden (kein Schema-Change). Falls ein Schema-Change wirklich der saubere Weg ist, ist er **erlaubt** (kein STOPP-Grund) — aber **im Schritt-0 begründen**, `db push` machen und danach **Dev-Server neu starten** (`tsx watch` lädt sonst den alten Prisma-Client). Kein `db:reset` (kaputt). Keine **neue Dependency**.

---

## 1. Arbeitsmodus

Autonom, selbst committen wenn Tests + Typecheck + Frontend-Build grün. STOPP nur bei echtem Blocker (Spec-Widerspruch mit Folgen, fehlende Spec, neue Dependency, technische Sackgasse). **Kein `git push`.** Bündel mit echtem `git status` + `git log`. Kein `Co-Authored-By`.

---

## 2. Schritt 0 — Recherche (read-only)

`git status -sb` + `git log --oneline -4` (lokal, kein `fetch`). Bericht → `BERICHTE/ACCOUNT_B_SCHRITT0.md` + 5–10 Zeilen. Prüfen:

1. **Redemption-Pfad** (`POST /auth/invite-redeem`, auth.ts): Wie wird aus Token + Invite ein User? **Insert-only** (neuer User aus Invite) oder **upsert/find-by-email** (setzt Passwort auf bestehendem User)? Das entscheidet, wie der Reset andockt:
   - Wenn der Pfad einen **bestehenden** User sauber behandeln kann → Reset = neuer Invite/Token für die Email des bestehenden Users, Redemption setzt nur das neue Passwort.
   - Wenn nicht → **minimale** Erweiterung wählen (bestehenden User beim Redeem erkennen → Passwort setzen statt duplizieren), **bevorzugt ohne** Schema-Change. Token-Infra (`tokens.ts`, SHA-256, `expiresAt`) wiederverwenden.
2. **`Invite`-Felder:** `isAdmin`/`isLeitung` existieren im Schema (§5.4) — werden sie vom **Create-Endpoint** (`POST /admin/invite`) schon entgegengenommen, und von der **Redemption** auf den erzeugten User **angewandt**? (Vermutung: Default false, nicht verdrahtet.)
3. **Invite-Formular** (Frontend, B2a.3): wo die Checkboxen andocken.
4. **Mitglied-Detail** (`AdminMitgliedDetail.tsx`, B2g): wo der Reset-Button + die Link-Anzeige andocken (Muster: Invite-Link-Anzeige aus B2a.3 — kopierbar).
5. **`KONFIGURATION.md` §5.1/§6.7:** nennen `deletedAt`; real ist `isActive` (Account-A-Erkenntnis) → Doku-Fix-Stellen markieren.

---

## 3. Inhalt

### 3.1 Admin-Passwort-Reset

- **Backend:** Endpoint (Form Code-Wahl, z.B. `POST /admin/users/:id/reset-password`), `requireAdmin`. Erzeugt für den **bestehenden** User einen einmaligen, ablaufenden Reset-Token (Magic-Link-/Token-Infra wiederverwenden) und gibt den **fertigen Link** zurück. Redemption über den Reset-Link setzt ein **neues Passwort** auf dem bestehenden User.
  - **Bestehendes Passwort bleibt gültig bis zum Einlösen** (kein Aussperren, falls der Link verloren geht). `isActive` bleibt unberührt (Reset reaktiviert nicht).
  - Nur für **aktive** User sinnvoll (inaktive → 400/404, Code-Wahl).
- **Frontend:** im Mitglied-Detail Button „Passwort zurücksetzen" → zeigt den Reset-Link **kopierbar** an (wie der Invite-Link in B2a.3), mit Hinweis „Link dem Mitglied selbst schicken". Kein Email-Versand.

### 3.2 Invite-als-Admin/Leitung

- **Backend:** `POST /admin/invite` nimmt `isAdmin` + `isLeitung` entgegen und speichert sie auf dem `Invite`. **Redemption** wendet beide Flags auf den erzeugten User an.
- **Frontend:** im Invite-Formular (B2a.3) zwei Checkboxen „als Verwalter (Admin)" / „als Leitung" (Default beide aus). Bestehender Flow (Link-Anzeige) unverändert.
- Damit lassen sich neue Verwalter (z.B. Sascha, Nils) direkt als Admin einladen, statt nachträglich im Detail zu ernennen.

### 3.3 KONFIGURATION-Doku-Fix (aus Account-A nachgezogen)

- `KONFIGURATION.md` §5.1 + §6.7: **`deletedAt` → `isActive`** (real existierendes Feld; Soft-Delete = `isActive=false`). Kurzer Changelog-Eintrag (Update 13) mit Hinweis: Doku an den realen Code angeglichen (kein Verhaltens-Change).

### Tests
- **Reset:** Endpoint erzeugt gültigen Token/Link (nur Admin); Einlösen setzt **neues** Passwort auf dem bestehenden User; Login mit neuem Passwort klappt; abgelaufener/ungültiger Token → Fehler; Nicht-Admin → 403.
- **Invite-Rolle:** Invite mit `isAdmin=true` → eingelöster User ist Admin; mit `isLeitung=true` → ist Leitung; ohne Flags → normales Mitglied.
- Bestehende Auth-/Invite-Tests bleiben grün.

### Bewusst NICHT in Account-B
- Self-Service „Passwort vergessen" (braucht Resend) → bleibt geparkt.
- 30-Tage-Hard-Delete-Job → out of scope.
- Keine neue Dependency.

---

## 4. Done-Kriterien (Lauras async Review)

- [ ] Admin kann im Mitglied-Detail einen **Reset-Link** erzeugen, kopieren und weiterleiten; Mitglied setzt darüber ein neues Passwort und kann sich damit einloggen
- [ ] Altes Passwort bleibt gültig bis der Link eingelöst ist; `isActive` unberührt
- [ ] Invite-Formular hat **Checkboxen „als Verwalter" / „als Leitung"**; eingeladene Person hat nach Einlösen direkt die Rolle
- [ ] `KONFIGURATION.md` §5.1/§6.7 sagen `isActive` statt `deletedAt` (+ Update 13)
- [ ] Nur Admin kann Reset auslösen + mit Rolle einladen (403 sonst)
- [ ] `pnpm --filter backend test` grün, Frontend-`build` grün; falls Schema-Change: im Bündel begründet + `db push` dokumentiert

---

## 5. Sandbox-/Test-Hinweise

- `db push` **nur** falls (begründeter) Schema-Change → danach **Dev-Server neu starten**. Kein `db:reset`. Bei stale/Port: `docker restart claude-bwza-getraenke` (Mac). Dev: `cd app && pnpm dev`.
- **Browser-Test Reset:** als Admin im Mitglied-Detail Reset auslösen → Link kopieren → in Inkognito/zweitem Profil öffnen → neues Passwort setzen → mit neuem Passwort einloggen. Altes Passwort vorher testen (klappt noch bis Einlösen).
- **Browser-Test Invite-Rolle:** Mitglied mit „als Verwalter" einladen → Link einlösen → eingeloggter User sieht den Admin-Bereich.

---

## 6. Abschluss (autonom, ohne Push)

Tests/Typecheck/Frontend-Build grün → Code committet selbst (Granularität dokumentiert; kein `Co-Authored-By`) → `BERICHTE/ACCOUNT_B_BUENDEL.md` mit echtem `git status` + `git log --oneline -N` + (falls vorhanden) Schema-Change-Begründung + Browser-Test-Anleitung → **STOPP ohne Push.** Laura reviewt, testet, pusht.
