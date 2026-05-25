# Design-Brief 02 — Vom Prototyp zum Produkt-Design

**Für:** Claude.ai/design (Folge-Iteration)
**Basis:** Bestehender Prototyp (`Bergwacht Zollernalb — Getränkekasse`, dunkle Bar-Atmosphäre, Glass-Komponenten, Bottom-Nav)
**Ziel:** Aus dem visuellen Konzept ein vollständiges, produktionsfertiges Screen-Set machen, das anschließend in React-Code übersetzt wird.

---

## Was bereits gut ist (BITTE BEIBEHALTEN)

Aus dem ersten Prototyp übernehmen wir komplett:

- ✅ **Dunkle Berghütten-Bar-Atmosphäre** mit Bar-Background-Foto und warmem Lampen-Glow
- ✅ **Farbpalette in OKLCH:** amber (#78% 0.16 70), amber-deep, amber-glow, rescue, ink-Töne
- ✅ **Glass-Card-Primitive** mit Backdrop-Blur und subtilem Amber-Border
- ✅ **ShineEdge** für die "polierte Glas"-Reflexion oben an Cards
- ✅ **BergMark** als Logo-Element
- ✅ **Fraunces** für Headlines, **Inter** für Body
- ✅ **Bottom-Nav** als Floating Pill mit 4 Tabs (Icons + Labels)
- ✅ **Flash-Toast-Pattern** (oben, fade-in)
- ✅ **DrinkConfirm-Bottom-Sheet**
- ✅ **Mobile-first 390×844**

---

## Was wir ändern müssen (PRODUKT-PIVOT)

Der erste Prototyp war ein **Kneipen-Kiosk** (gemeinsames Gerät, Member-Picker, PIN-Login). Wir bauen aber eine **Personal-App** (eigenes Handy, Email-Login). Das heißt konkret:

| Komponente | Alt (Prototyp) | Neu (Produkt) |
|---|---|---|
| **LockScreen** | Member-Grid mit Avataren | **EmailLoginScreen** mit Email + Passwort |
| **PinScreen** | 4-stellige PIN-Eingabe | **entfällt komplett** |
| **AufladenScreen** | Direkt aufladen (€5/€10/€20/€50) | **Aufladungs-Anfrage** stellen, Admin bestätigt |
| **Drink-Buchen** | balance < 1.50 → Button disabled | **Negatives Guthaben erlaubt**, Confirm-Sheet mit Warnung |
| **Member-Avatar in TopBar** | Farb-Avatar mit Initialen | **bleibt**, aber zeigt eigene Person (Eigenes Profil) |
| **Admin-Bereich** | nicht vorhanden | **neu hinzu**: 4 Screens |
| **Persönliche Statistik** | rudimentär (heute/Monat Zähler) | **ausbauen** mit Charts, Achievements |

---

## Neue Screens, die du designen sollst

Bitte alle im **bestehenden visuellen Stil** (Glass, Amber, Dunkel, Fraunces/Inter, BergMark im TopBar).

### 1. EmailLoginScreen
- **Headline:** "Willkommen zurück" (Fraunces)
- **Sub:** "Bergwacht Zollernalb · Getränkekasse"
- **Felder:** Email, Passwort (mit Show/Hide-Toggle)
- **Primärer Button:** "Anmelden" (Amber-Deep)
- **Sekundär-Link:** "Passwort vergessen?" (klein, ink-dim)
- **Footer:** "Noch keinen Zugang? Sprich deinen Getränkeverwalter an." (ink-mute, klein)
- **Layout:** Glass-Card zentriert auf Bar-Background, BergMark groß oben mittig

### 2. SetPasswordScreen (Magic-Link-Landing)
- **Headline:** "Setze dein Passwort"
- **Sub:** "Willkommen, {firstName} — leg los."
- **Felder:** Neues Passwort, Bestätigung
- **Stärke-Indikator:** unter dem ersten Feld, 4-Stufen-Balken (rot/orange/amber/grün)
- **Primärer Button:** "Account aktivieren"
- **Hinweis:** "Der Einladungs-Link ist nur einmal gültig."

### 3. PasswortVergessenScreen
- **Headline:** "Passwort vergessen"
- **Sub:** "Wir schicken dir einen Link per Mail."
- **Feld:** Email
- **Button:** "Link senden"
- **State nach Senden:** "Mail ist raus. Schau auch im Spam-Ordner."

### 4. AufladungAnfragenScreen (überarbeitet)
- **Headline:** "Guthaben aufladen"
- **Sub:** "Anfrage an Getränkeverwalter"
- **Betrag-Wahl:** 4 Chips (€5, €10, €20, €50) + Custom-Feld
- **Methode:** Toggle "Bargeld" / "PayPal manuell"
- **Notiz:** optionales Textfeld (z. B. "lade heute Abend an der Hütte auf")
- **Primärer Button:** "Anfrage senden"
- **Confirmation-State:** Flash-Toast oben + Status-Card "Anfrage gestellt — wartet auf Bestätigung"

### 5. Drink-Confirm bei negativem Guthaben (Bottom-Sheet-Variante)
- **Headline:** "Im Minus — trotzdem buchen?"
- **Getränk-Icon + Name + Preis**
- **Warnung:** "Dein Guthaben geht auf -X,XX €. Bitte zeitnah aufladen."
- **Buttons:** "Abbrechen" (Ghost) / "Trotzdem buchen" (Rescue/Rot statt Amber)
- **Subtext:** "Beim nächsten Hüttenabend bar oder per PayPal."

### 6. EigeneStatistikScreen (Verlauf-Tab + Stats)
- **Header-Stat-Cards:** 
  - "Diesen Monat" (Anzahl Getränke, große Zahl in Fraunces)
  - "Lieblings­getränk" (Glyph + Name)
  - "Streak" (Tage in Folge mit Aktivität)
- **Mini-Chart:** Balken-Diagramm der letzten 30 Tage
- **Achievement-Strip:** horizontal scrollbare Cards mit Badge-Icons (z. B. "Erste Aufladung", "10 Getränke", "1 Monat dabei")
- **Verlauf-Liste:** chronologisch, Transaktionen mit Glyph, Datum, Betrag

### 7. Profil-Menü / Drawer
- Erreichbar über Avatar-Tap im TopBar
- Eigener Name + Email
- Menüpunkte: "Mein Profil bearbeiten", "Datenschutz", "Meine Daten exportieren", "Account löschen", "Abmelden"
- Wenn Admin: extra Sektion "Admin-Bereich" mit Pfeil → eigener Screen-Stack

### 8. Admin: Mitglieder-Liste
- **Headline:** "Mitglieder" + Such-Input
- **Liste:** jede Zeile mit Avatar (Initialen + Farbe), Name, Guthaben (rot wenn negativ), kleiner Pfeil
- **FAB unten rechts:** "+ Einladen"

### 9. Admin: Mitglied einladen
- **Headline:** "Neues Mitglied einladen"
- **Felder:** Vorname, Nachname, Email
- **Primärer Button:** "Einladung verschicken"
- **Hinweis-Card:** "Es wird ein Magic-Link an die Email-Adresse geschickt. Der Link ist 7 Tage gültig."

### 10. Admin: Aufladungs-Anfragen
- **Tab-Switch oben:** "Offen" / "Erledigt"
- **Karten-Liste:** je Anfrage eine Glass-Card mit Mitglieder-Avatar, Betrag groß, Methode (Bar/PayPal), Notiz, Zeitstempel
- **Actions pro Karte:** "Bestätigen" (Amber) / "Ablehnen" (Rescue, sekundär)
- **Bei Bestätigung:** Flash-Toast "X € bei Y aufgeladen"

### 11. Admin: Transaktions-Log
- **Filter-Chips oben:** "Alle" / "Käufe" / "Aufladungen" / "Anpassungen"
- **Liste:** chronologisch absteigend, jede Zeile mit Glyph, Mitglied, Betrag (signed), Zeitstempel
- **Such-Feld** nach Mitglied
- **Export-Button:** "Als CSV"

### 12. Admin: Manuelles Guthaben anpassen
- Erreichbar aus Mitglieder-Detail
- **Headline:** "{Name}: Guthaben anpassen"
- **Aktuell-Anzeige:** "Aktuell: 4,50 €" (groß)
- **Eingabe:** Betrag (signed, z. B. +5 oder -2,50)
- **Pflicht-Notiz:** "Warum?" (z. B. "Bar bezahlt", "Korrektur Doppelbuchung")
- **Primärer Button:** "Anpassung speichern"

---

## Funktions-Hinweise pro Screen (kein State-Management, nur Visualisierung)

Bitte alle Screens als **statische Mockups mit realistischen Dummy-Daten** rendern. Keine echte API, kein echtes Routing — Claude.ai/design soll nur die visuelle Sprache fertigbauen. State-Management übernimmt später Claude Code.

Im Tweaks-Panel bitte alle Screens als Auswahl-Optionen anbieten, damit Laura durch die Screens klicken kann.

---

## Was als Export gebraucht wird

- **`tailwind.config.ts`** mit allen OKLCH-Tokens als CSS-Variablen
- **`design-tokens.css`** mit `:root`-Definition
- **Komponenten-Snippets** als TSX (Glass, ShineEdge, BergMark, BottomNav, FlashToast, DrinkConfirm, StatCard, GlassButton, GlassInput, TopBar)
- **Screen-Snippets** als TSX (alle 12 oben), so dass sie copy-paste-fähig in `frontend/src/routes/` landen können
- **`README_DESIGN.md`** mit:
  - Verwendungshinweisen pro Komponente
  - Liste der externen Assets (bar-bg.png, Fonts via Google Fonts)
  - Hinweis, dass Sound-Files separat kommen (nicht Teil des Designs)

---

## Akzeptanzkriterien

- [ ] Alle 12 Screens visuell durchspielbar
- [ ] Visuelle Konsistenz mit dem Prototyp (Glass, Amber, Fraunces, Bar-Background)
- [ ] Mobile-first (390×844 als Referenz)
- [ ] Touch-Targets mindestens 44×44 px
- [ ] Kontraste WCAG AA für Text (4.5:1 für Body, 3:1 für Large)
- [ ] Negativ-Guthaben-State sichtbar unterschiedlich (Rescue-Rot statt Ink)
- [ ] Admin-Bereich visuell klar vom User-Bereich abgegrenzt (z. B. dezenter "Admin"-Banner oben)
- [ ] Komponenten als TSX exportierbar (keine inline-styles, lieber CSS-Variablen + ggf. Tailwind)

---

## Wichtig: was du NICHT machen sollst

- ❌ Member-Picker als Login-Screen (Prototyp-Konzept, jetzt obsolet)
- ❌ PIN-Eingabe-Screens
- ❌ Direct-Aufladung ohne Admin-Bestätigung
- ❌ Bierkönig-Krone, Leaderboard, öffentliches Ranking — wir machen die Soft-Variante
- ❌ Light-Theme — wir bleiben durchgehend dark

---

## Bonus, wenn Zeit ist

- **Empty-States** für Anfragen-Liste, Verlauf, Mitglieder-Liste (Berg-Silhouette + freundlicher Spruch)
- **Loading-Skeletons** in Glass-Optik
- **Sound-Cue-Markierungen** im Code-Comment (z. B. `// SOUND: glass-clink on confirm`)
