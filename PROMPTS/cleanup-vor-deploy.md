# Vor-Deploy-Cleanup — Backend-Build grün + DB-Guards + offene-Anfragen + §5-Doku

**Phase:** Cleanup vor B8 (Deploy). Vier abgegrenzte Punkte (§3) — **Granularität entscheidet Code selbst** und dokumentiert sie. Punkt 1 ist **deploy-kritisch** (ohne grünen Backend-Build kein Produktions-Build in B8).
**Source of Truth:** `KONFIGURATION.md` (§5 Datenmodell — wird in Punkt 4 gegen die Realität abgeglichen), §6.9 (Lastverteilung), §6.5 (PayPal-Anfragen). Bei Doku↔Code-Widerspruch gewinnt **Code/Realität (CLAUDE.md §2)** — Doku wird angeglichen, nicht der Code verbogen.
**Voraussetzung:** B6 gepusht.
**Erwartung:** **kein Schema-Change, keine neue Dependency, kein `db push`.** Falls Code wider Erwarten einen für nötig hält → STOPP + im Schritt-0 begründen.
**Modus:** Voll autonom — Code committet selbst, pusht nicht. Kein `Co-Authored-By`.

---

## 1. Arbeitsmodus

Autonom, selbst committen wenn **alle drei** grün: `pnpm --filter backend test`, **`pnpm --filter backend build`** (neu: muss jetzt sauber durchlaufen!), `pnpm --filter frontend build`. STOPP nur bei echtem Blocker. **Kein `git push`.** Bündel mit echtem `git status` + `git log`. Kein `Co-Authored-By`.

---

## 2. Schritt 0 — Recherche (read-only)

`git status -sb` + `git log --oneline -4` (lokal, kein `fetch`). Bericht → `BERICHTE/CLEANUP_SCHRITT0.md` + 5–10 Zeilen. Pro Punkt prüfen:

1. **Backend-Build (deploy-kritisch):** `pnpm --filter backend build` laufen lassen, **die echten Fehler protokollieren**. Bekannt: `TS6059` (rootDir vs. `include` — `seed.ts`/`tests` außerhalb von `src`) + fragile `req.auth`-Augmentation (`auth/middleware.ts`). Klären: wie sind die Backend-`tsconfig`(s) + das `build`-Script aufgebaut, wo liegen `seed.ts`/`tests` relativ zu `rootDir`, wie ist `req.auth` typisiert/augmentiert.
2. **Storno-Admin-Guard:** in `buchen.ts` die Stelle, die `req.auth.isAdmin` (JWT) statt des DB-Stands prüft. Wie machen es die anderen Guards (B2j/B2k: DB-backed `requireAdmin`/`requireAdminOrLeitung`)? → dasselbe Muster.
3. **Offene PayPal-Anfragen bei Verwalter-Wegfall:** wo verliert ein Verwalter sein Recht (B2k Toggle „Verwalter-Recht entziehen") **und** wo wird er entfernt (Account-A `DELETE /admin/users/:id`). Was passiert mit seinen `AufladungsAnfrage`-Zeilen mit `status=OFFEN` + `zugewiesenerVerwalterId = er`? (Vermutung: bleiben hängen — niemand kann sie mehr bestätigen.) §6.9-Lastverteilungs-Funktion (least-loaded) lokalisieren — die wird für die Neuzuweisung wiederverwendet.
4. **§5-Doku-Drift:** `KONFIGURATION.md` §5 (alle Entitäten) gegen das echte `schema.prisma` halten und Abweichungen sammeln (bekannt: `deletedAt`→`isActive` schon gefixt, Invite schlank statt denormalisiert; prüfen: `AUSLAGE` raus (Cleanup), `verwalterId`, `zugewiesenerVerwalterId`, Feld-Namen/Typen).

Kein `db push` erwartet → durchbauen.

---

## 3. Inhalt

### 3.1 Backend-Build grün (deploy-kritisch)
Den Produktions-Backend-Build sauber machen, **ohne** Tests/Frontend zu brechen. Empfohlener Weg (Code bestätigt/justiert im Schritt-0):
- **Build-`tsconfig` auf `src` beschränken** (eigenes `tsconfig.build.json` o.ä., das `seed.ts`/`tests` ausschließt) und das `build`-Script darauf zeigen lassen → behebt `TS6059`. Dev/Test-Typecheck darf weiter breiter sein.
- **`req.auth`-Augmentation robust machen** (saubere, zuverlässig eingebundene Express-Request-Augmentation in einer `.d.ts`, statt fragiler Inline-/Global-Deklaration), sodass der Build typrein durchläuft.
- **Ziel:** `pnpm --filter backend build` läuft **fehlerfrei** und ist ab jetzt ein echtes Gate (kein „gefilterter Typecheck" mehr nötig).

### 3.2 Storno-Admin-Guard DB-backed
Die Storno-Admin-Prüfung in `buchen.ts` von `req.auth.isAdmin` (JWT) auf den **DB-Stand** umstellen (Muster der bestehenden DB-backed-Guards). Damit wirkt ein Rechtentzug sofort, nicht erst nach Token-Ablauf — konsistent mit B2j/B2k. **Test:** ein gerade demoteter User kann nicht mehr fremd-stornieren.

### 3.3 Offene PayPal-Anfragen bei Verwalter-Wegfall neu zuweisen
Verliert ein Verwalter sein Recht (**Demote** B2k) **oder** wird er **entfernt** (Account-A), werden seine **`OFFEN`**-`AufladungsAnfrage`-Zeilen automatisch dem **aktuell am wenigsten haltenden** aktiven Verwalter neu zugewiesen (§6.9-Logik wiederverwenden), `status` bleibt `OFFEN`. So bleibt jede Anfrage bestätigbar.
- Es existiert immer ≥1 Verwalter (Letzter-Admin-Schutz greift bei Demote/Remove) → Neuzuweisung hat immer ein Ziel.
- **Caveat (für Laura, nicht App-Logik):** Hat das Mitglied bereits an den alten Verwalter via PayPal gezahlt, klären die Verwalter das menschlich (die App kennt keinen PayPal-Zahlungsstatus). Die Neuzuweisung macht die Anfrage nur wieder *aktionierbar*.
- **Tests:** Demote eines Verwalters mit offener zugewiesener Anfrage → Anfrage hängt am least-loaded verbliebenen Verwalter; dito bei Account-A-Remove.

### 3.4 §5-Doku-Abgleich
`KONFIGURATION.md` §5 (Datenmodell) gegen das reale `schema.prisma` angleichen, sodass §5 wieder vertrauenswürdig ist (Feld-Namen/Typen, schlankes Invite, `isActive`, Enum-Werte inkl. entferntem `AUSLAGE`, `verwalterId`/`zugewiesenerVerwalterId`). Kurzer Changelog (Update 15): „§5 an reales Schema angeglichen, kein Verhaltens-Change". Gefundene Abweichungen im Bündel auflisten.

### Bewusst NICHT in dieser Phase
- Keine neuen Features, kein Schema-Change, keine neue Dependency.
- Hetzner/Postgres/Subdomain/HTTPS → **B8** (nächste Phase).

---

## 4. Done-Kriterien (Lauras Review)

- [ ] **`pnpm --filter backend build` läuft fehlerfrei** (keine `TS6059`, robuste `req.auth`-Typen) — der entscheidende Punkt für B8
- [ ] `pnpm --filter backend test` weiter grün (197), `pnpm --filter frontend build` grün
- [ ] Storno-Admin-Guard prüft DB-Stand; demoteter User kann nicht mehr fremd-stornieren (Test)
- [ ] Offene PayPal-Anfragen eines wegfallenden Verwalters werden neu zugewiesen (Demote + Remove), bleiben `OFFEN` und bestätigbar (Tests)
- [ ] `KONFIGURATION.md` §5 stimmt mit `schema.prisma` überein (+ Update 15); Abweichungsliste im Bündel
- [ ] Kein Schema-Change, keine neue Dependency

---

## 5. Sandbox-/Test-Hinweise

- Kein `db push`/`db:reset`. Bei stale/Port: `docker restart claude-bwza-getraenke` (Mac). Dev: `cd app && pnpm dev`.
- **Browser-Test (knapp, das meiste ist test-/build-verifiziert):** einen zweiten Verwalter anlegen, ihm via Mitglied eine PayPal-Anfrage zuweisen lassen (offen), dann diesen Verwalter demoten/entfernen → die Anfrage taucht jetzt beim verbliebenen Verwalter in „Aufladungs-Anfragen" auf und ist bestätigbar.

---

## 6. Abschluss (autonom, ohne Push)

Alle drei Gates grün (test + **backend build** + frontend build) → Code committet selbst (Granularität dokumentiert; kein `Co-Authored-By`) → `BERICHTE/CLEANUP_BUENDEL.md` mit echtem `git status` + `git log --oneline -N` + Vorher/Nachher des Backend-Builds + §5-Abweichungsliste + knapper Browser-Test → **STOPP ohne Push.** Laura reviewt, testet, pusht.
