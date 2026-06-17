# Phase B_GAME_ALPINIST — Bergwacht Jump & Run (Standalone Phaser.js)

**Status:** 🎮 Neue Phase nach Live-Go (B1–B9 abgeschlossen)  
**Ziel:** Standalone Phaser.js Jump & Run Spiel, später React-Integration  
**Größenordnung:** 2–3 Tage für poliertes Level 1 + Score-API

---

## 1. Kontext & Anforderung

Die Getränkekasse läuft live (15–30 Mitglieder). Als nächstes Feature wollen wir ein **einfaches Jump & Run im Super Mario Game Boy Stil** bauen — **Bergwacht-Rettungs-Szenario:**

- Charakter: Alpinist mit Helm
- Ziel: Windenhaken des Hubschraubers (oben rechts) erklimmen, absprung → abgeflogen
- Gegner: dumme AI (Steine fallen, gegnerische Kletterer)
- Collectibles: Karabiner (Score), Seile, Getränke-Icons
- Bestenliste: Wochenweise Top-Scores, humorvoller Ton („der alte Platz 1 schuldet dem neuen ein Getränk")

**Phasen-Spezifik:**
- **Nur Level 1** (später ausbauen)
- **Standalone Phaser.js App** in eigenem `game/`-Ordner
- **Mobile-ready** (Touch-Controls: Swipe-Links/Rechts, Tap zum Springen)
- **Score-API:** `POST /api/game/scores` → Backend speichert in `GameScore`-Modell
- **Später:** React-Integration (neue Route `/game` oder BottomNav-Tab 🎮)

---

## 2. Tech-Stack (Spiel)

| Bereich | Entscheidung |
|---|---|
| Game-Engine | Phaser.js 3.x (canvas-based, super Mario ist Standard-Tutorial) |
| Build-Tool | Webpack oder Vite (ähnlich wie Frontend) |
| Assets | Pixel-Art Sprites (selbst zeichnen oder Open-Source) |
| Physics | Phaser Physics (Arcade für Jump & Run, nicht overkill) |
| Sound | Optional (Web Audio API, aber erst ab B_GAME v2) |
| API-Client | Fetch oder Axios (wie Frontend) |

---

## 3. Verzeichnis-Struktur

```
LauraSauerBWZA/getraenkekasse/
├── app/
│   ├── backend/      (existing)
│   ├── frontend/     (existing)
│   └── game/         ← NEW
│       ├── public/
│       │   └── assets/
│       │       ├── sprites/
│       │       │   ├── alpinist.png      (4x Frames: idle, run, jump, fall)
│       │       │   ├── gegner.png        (fallende Steine, laufende Gegner)
│       │       │   ├── plattformen.png   (Felsen, Eis, Holz)
│       │       │   ├── collectibles.png  (Karabiner, Seil, Getränk)
│       │       │   ├── windenhaken.png   (Ziel)
│       │       │   └── hud.png           (UI-Elemente)
│       │       └── sounds/ (optional, später)
│       ├── src/
│       │   ├── index.js                  (Entry-Point)
│       │   ├── config.js                 (Phaser-Config)
│       │   ├── scenes/
│       │   │   ├── BootScene.js          (Preload Assets)
│       │   │   ├── MenuScene.js          (Start-Screen, Bestenliste-Preview)
│       │   │   ├── Level1Scene.js        (Hauptgame)
│       │   │   ├── GameOverScene.js      (Game Over, Score anzeigen)
│       │   │   └── WinScene.js           (Level Complete, Windenhaken-Abflug-Animation)
│       │   ├── sprites/
│       │   │   ├── Player.js             (Charakter-Logik, Steuerung)
│       │   │   ├── Enemy.js              (Gegner-AI)
│       │   │   ├── Platform.js           (Plattform-Logik)
│       │   │   └── Collectible.js        (Karabiner, Seil, Getränk)
│       │   ├── utils/
│       │   │   ├── api.js                (POST /api/game/scores)
│       │   │   ├── physics.js            (Hilfsfunktionen für Collision)
│       │   │   └── mobile.js             (Touch-Controls)
│       │   └── constants.js              (Game-Konstanten, Farben aus design-tokens)
│       ├── index.html                    (Standalone HTML)
│       ├── package.json                  (Phaser + Dependencies)
│       ├── webpack.config.js             (oder vite.config.js)
│       └── README.md                     (Setup + Dev-Anweisungen)
```

---

## 4. Datenmodell — Backend-Seite

### GameScore (neue Prisma-Entität)

```prisma
model GameScore {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  level     Int      @default(1)          // Level erreicht (1 = Level 1)
  score     Int                            // Summen-Score (aus Collectibles + Höhe)
  timeMs    Int                            // Spielzeit in Millisekunden
  
  collectiblesFound Int @default(0)        // Anzahl Karabiner/Seile gesammelt
  enemiesDefeated   Int @default(0)        // Gegner besiegt
  livesLost         Int @default(0)        // Gesamtleben verloren (3 - verbleibend)
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([userId])
  @@index([createdAt])
}
```

### Backend-Route: `POST /api/game/scores`

```
Body:
{
  level: 1,
  score: 2850,
  timeMs: 145000,
  collectiblesFound: 12,
  enemiesDefeated: 5,
  livesLost: 1
}

Response:
{
  id: "cuid...",
  userId: "user-id",
  level: 1,
  score: 2850,
  createdAt: "2026-06-16T14:23:45.000Z"
}
```

### Route: `GET /api/game/scores/leaderboard?timeframe=week`

```
Response:
{
  leaderboard: [
    {
      rank: 1,
      userId: "user-1",
      userName: "Laura Sauer",
      score: 3200,
      level: 1,
      timeMs: 120000,
      createdAt: "2026-06-16T10:00:00Z",
      isCurrentUser: true
    },
    ...
  ]
}
```

---

## 5. Level 1 Design

### Map-Layout

```
Höhe 0m (Boden):          [Hubschrauber 🚁 + Windenhaken ⚓]
Höhe -50m:                       ░░░░░░░░░░  (Plattform 1)
Höhe -100m:        ░░░░░░  ★  ░░░░░░░░     (Plattform 2, Karabiner)
Höhe -150m:        ░░░░░░░░░░░░░░░░         (lange Plattform)
Höhe -200m:             ░░░░░░  ★  ░░░░     (Plattform 3, Seil)
Höhe -250m:        ░░░░░░░░  🔴  ░░░░       (Gegner laufen)
Höhe -300m:              ░░░░░░░░           (Sprung-Challenge)
Höhe -350m:        ░░░░░░░░░░░░░░░░░░░░    (breite Plattform)
START (ca. -400m): [Charakter starten hier]
```

**Schwierigkeit:** Easy-Normal-Mix (Super Mario Game Boy Level 1-1 Inspiration)

### Plattformen (ca. 8-10 Haupt-Plattformen)

- **Breite (~150px):** Einstiegs-Plattformen, Safe Zones
- **Mittlere (~80px):** Standard
- **Schmale (~40px):** Precision-Jumps, später im Level
- **Moving-Plattformen:** 2-3 mit langsamer horizontaler Bewegung

### Gegner (ca. 5-8 pro Level)

1. **Fallende Steine** (von oben): Einfach Physics-Objekte, die runterfallen, musst ausweichen
   - Spawn alle 2-3 Sekunden
   - Schaden: −1 Leben (oder passieren direkt durch?)

2. **Gegnerischer Bergsteiger:** Dumme AI
   - Laufen horizontal hin und her auf ihrer Plattform
   - Wenn du auf sie springst: defeated (Sprung-Jump auf Kopf = +100 Score)
   - Wenn du sie berührst: −1 Leben

### Collectibles (ca. 12-15 im Level)

- **🔷 Karabiner (Gold):** +50 Score, häufig verteilt
- **🔶 Seil (Orange):** +30 Score, seltener
- **🟢 Getränk-Icon:** +100 Score, 2-3 pro Level, versteckt bei Precision-Jumps

---

## 6. Game-Mechanik

### Steuerung (Desktop + Mobile)

**Desktop:**
- **← Pfeiltaste:** Nach links gehen
- **→ Pfeiltaste:** Nach rechts gehen
- **Space:** Springen
- **ESC:** Pause (später)

**Mobile (iOS/Android):**
- **Swipe Links/Rechts:** Move (obere 2/3 des Screens)
- **Tap unten:** Springen (unteres 1/3 des Screens)
- **Button „Menu":** Zurück (ESC equivalent)

### Physics

- **Gravity:** 600 (Phaser default)
- **Jump Power:** −400 (velocity.y = -400)
- **Max Fall Speed:** 400
- **Horizontal Speed:** 150 (walking), 0 (idle)
- **Friction:** 0 (responsive, Mario-like)

### Lebensystem

- **Starten mit 3 Leben**
- **−1 Leben wenn:** berühren Gegner ODER fallen unter die Map (off-screen)
- **0 Leben:** Game Over

### Score-Berechnung

```
Score = (collectiblesFound * wert) + (höheErreicht / 100) + (enemiesDefeated * 100)
```

z.B. 12 Karabiner (50 pts) + 5 Seile (30 pts) + Höhe 300m + 3 Gegner = 600 + 150 + 300 + 300 = 1350 Score

---

## 7. Szenen-Flow

### BootScene
- Laden der Assets (Sprites)
- Übergang zu MenuScene

### MenuScene
- **Start-Button** („Level 1 spielen")
- **Bestenliste-Preview** (Top 5 diese Woche)
- **Humorvoller Text:** „Alpinist der Woche: Laura Sauer 🏆 | Alte Nummer 1 schuldet neuem 1. ein Getränk 🍺"
- Button: „Highscores anschauen" → scrollbare Liste

### Level1Scene (Hauptgame)
- **HUD oben links:** Leben (♥♥♥), Score live, Höhe (−50m, −100m, etc.)
- **Player-Spawn:** Unten, Charakter ist sichtbar
- **Gameplay-Loop:** Jump, sammeln, gegner vermeiden, höher kommen
- **Kamera:** Follows Player, zoomt aus wenn oben nah dran (Anticipation vor Windenhaken)
- **Ziel erreichen:** Wenn Player den Windenhaken-Hotspot berührt → WinScene

### WinScene
- **Animation:** Seil wickelt auf, Hubschrauber fliegt weg (2-3 Sekunden)
- **Score-Summary:** Karabiner gesammelt, Höhe, Zeit, Gegner
- **Gesamt-Score** + Datenbank-Speicherung (API-Call POST)
- **Bestenlisten-Platzierung:** „🏆 Du bist jetzt Platz 3!" oder „🥇 Neuer Rekord!"
- **Buttons:** „Nochmal spielen", „Zurück zum Menü", „Bestenliste anschauen"

### GameOverScene
- **Grund:** Kein Leben mehr ODER Timeout (max 5 Minuten / 300 sec)
- **Score angezeigt** (kein Speichern, nur Anzeige)
- **Buttons:** „Erneut versuchen", „Zurück zum Menü"

---

## 8. Asset-Anforderungen (Pixel-Art)

### Charakter (Alpinist) 32x32px, 4 Frames
1. **Idle:** Standing auf Fels
2. **Run:** Laufen-Animation (2 Frames alternierend)
3. **Jump:** Springende Pose
4. **Fall:** Fallende Pose

**Style:** Bergwacht-gelb, Helm, einfach erkennbar, Super Mario GB Proportionen

### Gegner (zwei Typen)

**Fallender Stein:** 16x16px, 1 Frame (einfache Sprite)  
**Bergsteiger-Gegner:** 24x24px, 2 Frames (gehen hin/her)

### Plattformen (Tileset)

32x32px Kacheln (wie Mario Bricks):
- **Fels (Dunkelgrau):** Haupt-Plattform
- **Eis (Hellblau):** Rutschig (höhere Geschwindigkeit? Oder nur visuell)
- **Holz (Braun):** Optisch unterschiedlich, gleiche Physik

### Collectibles

- **Karabiner:** 16x16px, Spin-Animation
- **Seil:** 12x16px, Wave-Animation
- **Getränk-Icon:** 20x20px, Glow-Animation

### HUD-Elemente

- **Herz (♥):** 16x16px
- **Windenhaken:** 32x32px (Ziel-Sprite)
- **Hubschrauber:** 64x32px (oben rechts, wird am Ende animiert)

### Farben (aus design-tokens.css)

```
Background: --bwza-dark-900 (sehr dunkelbraun)
Plattformen: --bwza-amber-700, --bwza-blue-600
Score-Text: --bwza-amber-300
UI: --bwza-glass-border (glasmorphism-Effekt auf HUD)
```

---

## 9. Sub-Commits (8-10 logische Einheiten)

### B_GAME.1: Phaser-Setup + BootScene
- `game/` Ordner, webpack/vite Config
- BootScene mit Asset-Preload
- MenuScene Stub
- **Output:** `npm run dev` startet lokal, zeigt Menu

### B_GAME.2: Level1Scene + Plattformen
- Level1Scene angelegt
- Plattform-Array (8-10 Plattformen, fest positioniert)
- Kamera folgt Player
- Collider-Gruppen (Player vs Plattformen)
- **Output:** Plattformen sind sichtbar, keine Bewegung noch

### B_GAME.3: Player-Sprite + Bewegung
- Player-Klasse (extends Sprite)
- Tastatur-Steuerung (← → Space)
- Sprung-Physik (gravity, jump-power)
- Animationen (idle, run, jump, fall)
- **Output:** Charakter läuft herum, springt, Physics funktionieren

### B_GAME.4: Gegner (Steine + AI)
- Fallende Steine (Spawn-Rate, Physics)
- Gegner-Bergsteiger-Klasse (hin/her laufen)
- Collision Player vs Gegner (−1 Leben oder besiegt)
- Gegner-Respawn
- **Output:** Gegner spawnen, bewegen sich, Collision funktioniert

### B_GAME.5: Collectibles
- Karabiner, Seil, Getränk Sprites
- Spawn auf bestimmten Plattformen
- Collision Player vs Collectible (+Score, despawn)
- Animationen (spin/wave/glow)
- **Output:** Items sammeln, Score steigt

### B_GAME.6: HUD + Score-Rendering
- Leben-Anzeige (♥♥♥)
- Score live oben anzeigen
- Höhen-Anzeige (−50m, −100m, etc.)
- Spielzeit-Zähler (oben rechts)
- **Output:** HUD ist vollständig sichtbar, Zahlen updaten

### B_GAME.7: Windenhaken-Ziel + WinScene
- Windenhaken-Sprite (oben rechts, Hotspot)
- Collision Player vs Windenhaken → Trigger WinScene
- WinScene: Animation (Seil wickelt, Hubschrauber fliegt weg)
- Score-Summary anzeigen
- **Output:** Spiel kann gewonnen werden, Animation ist sichtbar

### B_GAME.8: Score-API + Leaderboard
- Backend-Route POST `/api/game/scores`
- GameScore Prisma-Modell + Migration
- WinScene ruft API auf (speichert Score in DB)
- MenuScene zeigt Leaderboard-Preview (GET `/api/game/scores/leaderboard?timeframe=week`)
- **Output:** Scores werden gespeichert, Bestenliste funktioniert

### B_GAME.9: Mobile-Steuerung (Touch)
- Touch-Event-Handler (Swipe Links/Rechts, Tap unten zum springen)
- Mobile-optimiertes HUD (Buttons größer)
- Responsive Canvas (fullscreen auf Mobile)
- Test auf iPhone + Android (Emulator oder echtes Gerät)
- **Output:** Spiel ist spielbar auf Mobile

### B_GAME.10: MenuScene + Bestenlisten-UI
- MenuScene komplett (Start-Button, Bestenlisten-Anzeige, humorvoller Text)
- GameOverScene (Grund, Nochmal-Button, Menu-Button)
- Navigation zwischen Szenen
- **Output:** Kompletter Spiel-Loop funktioniert (Menu → Spiel → Win/Over → Menu)

---

## 10. Backend-Integration

### Prisma Schema-Änderung

```prisma
model GameScore {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  level           Int       @default(1)
  score           Int
  timeMs          Int
  collectiblesFound Int     @default(0)
  enemiesDefeated Int       @default(0)
  livesLost       Int       @default(0)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([userId])
  @@index([createdAt])
}
```

### Express-Routes (zu `backend/src/routes/game.ts` anlegen)

```typescript
// POST /api/game/scores — Score speichern
router.post('/scores', requireAuth, async (req, res) => {
  const { level, score, timeMs, collectiblesFound, enemiesDefeated, livesLost } = req.body;
  const gameScore = await prisma.gameScore.create({
    data: {
      userId: req.user.id,
      level,
      score,
      timeMs,
      collectiblesFound: collectiblesFound || 0,
      enemiesDefeated: enemiesDefeated || 0,
      livesLost: livesLost || 0,
    },
  });
  res.json(gameScore);
});

// GET /api/game/scores/leaderboard?timeframe=week
router.get('/scores/leaderboard', async (req, res) => {
  const { timeframe = 'week' } = req.query;
  const since = new Date();
  if (timeframe === 'week') since.setDate(since.getDate() - 7);
  if (timeframe === 'month') since.setMonth(since.getMonth() - 1);
  
  const scores = await prisma.gameScore.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { score: 'desc' },
    take: 20,
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
  });
  
  res.json({ leaderboard: scores });
});
```

### Frontend-Integration (später in Phase B_GAME_INTEGRATION)

```jsx
// app/frontend/src/pages/Game.tsx
import { useEffect, useRef } from 'react';
import { useAuth } from '../lib/auth';

export default function GamePage() {
  const containerRef = useRef(null);
  const { user } = useAuth();
  
  useEffect(() => {
    // Dynamisch Phaser-App laden/initialisieren
    // Phaser Game-Instanz mit callback für API-Calls
    // gameInstance.on('scoreSubmit', (score) => {
    //   fetch(`/api/game/scores`, { method: 'POST', body: JSON.stringify(score) })
    // })
  }, [user]);
  
  return <div ref={containerRef} style={{ width: '100%', height: '100vh' }} />;
}
```

---

## 11. Browser-Test Checkliste (vor jedem Sub-Commit)

### Desktop (Mac Chrome/Safari)

- [ ] Level startet ohne Fehler in der Konsole
- [ ] Charakter kann sich bewegen (← → Space)
- [ ] Gravität/Jump-Physics funktioniert (Character fällt, springt korrekt)
- [ ] Collectibles sammeln funktioniert (Score steigt)
- [ ] Gegner bewegen sich und Collision funktioniert
- [ ] HUD aktualisiert sich live
- [ ] Windenhaken erreichbar, WinScene triggert korrekt
- [ ] Score wird in DB gespeichert + Leaderboard zeigt den neuen Score

### Mobile (iPhone/Android, Emulator oder echtes Gerät)

- [ ] Spiel lädt in Safari/Chrome Mobile
- [ ] Tap-Steuerung funktioniert (jump)
- [ ] Swipe-Steuerung funktioniert (links/rechts)
- [ ] HUD ist lesbar (nicht zu klein)
- [ ] Keine Layout-Bugs (Canvas füllt Screen aus)
- [ ] Performance: kein Lag, smooth 60fps

---

## 12. Bekannte Stolperstellen

1. **Phaser Module-Bundling:** Webpack muss Phaser richtig bundeln. Vite ist einfacher, aber beide funktionieren.
2. **Asset-Paths:** Relative Paths zu `public/assets/` müssen stimmen.
3. **Physics:** Arcade-Physics ist gut, aber `setCollideWorldBounds()` muss korrekt gesetzt sein (sonst fällt Player unendlich).
4. **Mobile Touch-Events:** Window-Größe kann variieren — responsive Canvas ist wichtig.
5. **API-Integration:** User muss eingeloggt sein, sonst API-Call fehlschlagen. `fetch` Credentials mitschicken!
6. **Bestenlisten-Tie-Break:** Wenn zwei User denselben Score haben, chronologisch sortieren (wer zuerst).

---

## 13. Definition of Done (Sub-Commit)

Jeder Sub-Commit ist done wenn:

- ✅ Code ist committed (mit aussagekräftiger Message)
- ✅ 5–10 Min Desktop-Browser-Test erfolgreich
- ✅ 2–3 Min Mobile-Test erfolgreich (emuliert oder iPhone)
- ✅ Keine TypeScript/ESLint-Fehler
- ✅ Game läuft ohne Console-Errors
- ✅ Commit-Message ist präzise (z.B. „B_GAME.3: Player-Sprite + Tastatur-Steuerung")

---

## 14. Zeitschätzung

- **B_GAME.1 (Setup):** 15–20 Min
- **B_GAME.2 (Plattformen):** 20–30 Min
- **B_GAME.3 (Player + Bewegung):** 30–45 Min
- **B_GAME.4 (Gegner):** 30–40 Min
- **B_GAME.5 (Collectibles):** 20–30 Min
- **B_GAME.6 (HUD):** 20–30 Min
- **B_GAME.7 (Windenhaken + WinScene):** 25–35 Min
- **B_GAME.8 (Score-API + Leaderboard):** 40–60 Min (Backend + Frontend + Tests)
- **B_GAME.9 (Mobile):** 30–45 Min (Testing intensiv)
- **B_GAME.10 (MenuScene + Szenen-Flow):** 25–35 Min

**Gesamt:** 4–6 Stunden aktive Entwicklung über 2–3 Tage (inklusive Browser-Tests, Iteration, Fixes).

---

## 15. Später: React-Integration (Phase B_GAME_INTEGRATION)

Nach diesem Sub-Commit ist das Spiel **funktional und standalone**. Die React-Integration kommt dann in einer **neuen Phase B_GAME_INTEGRATION:**

- Neue Route `/game` im Frontend-Router
- Oder neuer Tab im BottomNav (🎮)
- Spiel-Canvas wird in React-Komponente eingebunden
- Bestenlisten-Link führt zur Leaderboard-Seite (später in B_STATS)

Das ist **separat** und low-priority nach diesem Spiel-Launch.

---

**Phase B_GAME_ALPINIST ist ready. Claude Code kann los!**
