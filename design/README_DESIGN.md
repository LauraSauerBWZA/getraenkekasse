# Bergwacht Zollernalb · Getränkekasse — Design-Pack v2

Visuelle Sprache + 12 Screen-Mockups, bereit für die React-Implementierung.

## Was hier liegt

| Datei | Zweck |
|---|---|
| `index.html` | Vorschau-Shell, lädt React + alle Module |
| `design-tokens.css` | OKLCH-Farben, Radien, Schatten, Typ-Skala als `:root`-Variablen — **direkt in `frontend/src/styles/` übernehmen** |
| `components.jsx` | Wiederverwendbare Primitive: `Glass`, `ShineEdge`, `BergMark`, `Avatar`, `TopBar`, `BottomNav`, `GlassButton`, `GlassInput`, `PasswordInput`, `StatCard`, `Flash`, `EmptyState`, `Skeleton`, `DrinkConfirm`, `ProfileDrawer`, `AdminBanner` |
| `screens-user.jsx` | User-Screens 1–7 (Login, Set-Passwort, Forgot, Home, Buchen, Aufladen-Anfrage, Statistik) |
| `screens-admin.jsx` | Admin-Screens 8–12 (Mitglieder, Einladen, Anfragen, Log, Anpassen) |
| `app.jsx` | Screen-Router + Tweaks-Panel (Screen-Picker + Demo-Schalter) |
| `assets/bar-bg.png` | Background-Foto |
| `Getränkekasse v1.html` | Erster Kiosk-Prototyp (zum Vergleich, separat lauffähig) |

## Externe Abhängigkeiten

- **Google Fonts**: `Fraunces` (opsz 9–144, 400/500/600/700), `Inter` (400–700), `JetBrains Mono` (400/500)
- **React 18** (im Prototyp via UNPKG; in der echten App via npm)
- **Sound-Files** kommen separat — nicht Teil dieses Design-Packs. Marker im Code stehen als `// SOUND: …`-Kommentare.

## Screen-Inventar (12)

Navigation zwischen Screens im Prototyp über Tweaks-Panel (`Anzeigen`-Dropdown) **oder** Bottom-Nav.

### Auth (öffentlich)
1. **EmailLoginScreen** — Email + Passwort, Show/Hide-Toggle, "Passwort vergessen?"
2. **SetPasswordScreen** — Magic-Link-Landing, Stärke-Indikator (4-Stufen-Balken), Bestätigungsfeld
3. **PasswortVergessenScreen** — Email-Input + "Mail-ist-raus"-State

### User (eingeloggt)
4. **HomeScreen** — Balance-Card (amber-glow oder rescue-rot bei Minus), Stat-Strip, 6 Quick-Drinks, Aufladen-CTA
5. **BuchenScreen** — alle 8 Getränke à 1,50 € als 2-spaltiges Grid
   - **5a/5b** — Bottom-Sheet `DrinkConfirm`, zwei Varianten:
     - `confirm-pos`: normales Anschreiben (Amber)
     - `confirm-neg`: Im-Minus-Warnung (Rescue/Rot, "Trotzdem buchen")
6. **AufladungAnfragenScreen** — Chip-Auswahl (5/10/20/50 €) + Custom-Feld, Methode (Bargeld/PayPal), Notiz, "Anfrage senden"
   - **6a**: Mit Status-Card "Anfrage gestellt" oben
7. **StatistikScreen** — Monatszahl + Streak, Lieblingsgetränk-Card, 30-Tage-Balkendiagramm, Achievement-Strip, Verlaufs-Liste
   - **7a · ProfileDrawer** — Bottom-Sheet vom Avatar-Tap, mit Admin-Sektion wenn `isAdmin`

### Admin (separater Bereich, mit Banner)
8. **AdminMembersScreen** — Suchbar + Liste mit Avatar/Name/Guthaben (rot bei Minus), FAB "+ Einladen"
9. **AdminInviteScreen** — Vorname/Nachname/Email, Hinweis-Card "7 Tage gültig"
10. **AdminRequestsScreen** — Tab-Switch Offen/Erledigt, Karten mit Bestätigen/Ablehnen-Actions
11. **AdminLogScreen** — Filter-Chips (Alle/Käufe/Aufladungen/Anpassungen), Such-Feld, CSV-Export
12. **AdminAdjustScreen** — Aktuelles Guthaben groß, Delta-Eingabe (signed), Quick-Steppers, Pflicht-Notiz

## Komponenten-Hinweise

### `Glass`
Drei Tones: `dark` (Standard), `raise` (etwas heller), `amber` (warmer Akzent für Balance/Hero-Cards). Backdrop-Blur ist auf `var(--bwza-blur-glass)` gemappt.

### `GlassButton`
Varianten: `primary` (Amber-Gradient), `danger` (Rescue-Rot, für Im-Minus-Buchung & Account-Löschen), `ghost` (dunkler Glas-Outline), `quiet` (nur Text). Sizes `sm/md/lg`. `full` für 100 % Breite.

### `GlassInput` / `PasswordInput`
Focus-Ring in Amber. `error`-Prop für rote Border + Hint. `PasswordInput` hat Eye-Toggle.

### `BottomNav`
Hat zwei Modi: `mode="user"` (Theke / Buchen / Aufladen / Statistik) und `mode="admin"` (Mitglieder / Anfragen / Log / Zurück). Admin-Tab-Highlight ist Rescue-Rot statt Amber.

### `TopBar`
Linke Seite: BergMark + Wortmarke. Bei `admin`-Flag wechselt der Titel auf "Admin · BWZA" und der Untertitel zeigt den Screen-Namen. Rechte Seite: Avatar als Drawer-Trigger (über `onAvatar`).

### `DrinkConfirm`
Erkennt selbständig, ob das Guthaben durch die Buchung negativ wird, und schaltet auf die Danger-Variante (rote Border, Warn-Card, "Trotzdem buchen"-Button in Rescue-Rot).

## Übernahme in `frontend/src/`

```
frontend/src/
├── styles/
│   ├── design-tokens.css   ← (1) hier reinkopieren
│   └── globals.css         ← @import './design-tokens.css';
├── components/
│   ├── primitives/         ← Inhalt von components.jsx aufsplitten
│   │   ├── Glass.tsx
│   │   ├── GlassButton.tsx
│   │   ├── GlassInput.tsx
│   │   ├── Avatar.tsx
│   │   ├── BergMark.tsx
│   │   └── …
│   └── overlays/
│       ├── DrinkConfirm.tsx
│       ├── ProfileDrawer.tsx
│       └── Flash.tsx
└── routes/
    ├── auth/
    │   ├── login.tsx
    │   ├── set-password.tsx
    │   └── forgot.tsx
    ├── (app)/
    │   ├── home.tsx
    │   ├── buchen.tsx
    │   ├── aufladen.tsx
    │   └── statistik.tsx
    └── admin/
        ├── members.tsx
        ├── invite.tsx
        ├── requests.tsx
        ├── log.tsx
        └── adjust.tsx
```

Beim Port nach TSX:
- `style={{...}}`-Objekte sollten in CSS Modules / Tailwind-Klassen wandern, die Werte selbst sind aber konsistent als `var(--bwza-*)` referenziert.
- State-Management & Routing: nicht in diesem Pack — das macht Claude Code.
- Sound-Cues: in `DrinkConfirm.onConfirm` und `AdminRequestsScreen.onApprove` als `// SOUND: glass-clink` markiert (jetzt nachträglich, falls gewünscht — bitte sagen).

## Akzeptanz-Check

- [x] Alle 12 Screens visuell durchspielbar (über Tweaks-Picker)
- [x] Visuelle Konsistenz mit Prototyp (Glass / Amber / Fraunces / Bar-Background)
- [x] Mobile-first 390×844, alle Touch-Targets ≥ 44 × 44 px (Buttons mit `size="md/lg"`)
- [x] Negatives Guthaben unterscheidbar (Rescue-Rot, Border, Badge "Schulden")
- [x] Admin-Bereich klar abgegrenzt (Banner oben, andere Nav-Akzent-Farbe)
- [x] Tokens als CSS-Variablen → leicht in Tailwind übertragbar
- [x] Empty-States in `EmptyState`-Komponente (Berg-Silhouette + Spruch)
- [x] Loading-Skeletons in Glass-Optik (`Skeleton`-Komponente)
