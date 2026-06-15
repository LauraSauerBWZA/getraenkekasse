# Bergwacht Zollernalb · Getränkekasse — Design-System (B5c „Visual Redirection")

**Stand:** 2026-06-15 (Update 10). Dieses Dokument ist die aktuelle Design-
Autorität (Tier 5). Es löst die frühere „Dark-Bar / Amber / Fraunces"-Ästhetik ab.

> **Historie:** Die Design-Pack-v2-Mockups (`components.jsx`, `screens-*.jsx`,
> `app*.jsx`) zeigen den **alten** warmen Amber/Fraunces-Look und sind nur noch
> historische Referenz. Logo/Wortmarke (`BergMark`) bleiben nutzbar; **Farben,
> Schrift und Flächen folgen ab hier diesem Dokument.** Source of Truth für Werte:
> `frontend/src/styles/design-tokens.css`.

---

## Charakter

**Kühl, mehrfarbig, echtes Glass, eine Sans (Inter).** Dunkler, kühler Charcoal-
Grund mit dezentem Teal-Schimmer oben. Inhalte liegen auf **Milchglas-Karten mit
zarter oberer Lichtkante** (Backdrop-Blur, CSS-only). Akzent ist **Teal**; die
Domäne wird über ein klares Farbsemantik-Set geführt. Großzahlen sind **leicht**
(Weight 300), Beträge **tabellarisch**.

## Palette (Tokens)

| Token | Wert | Rolle |
|---|---|---|
| `--bwza-bg` | `#0D1116` | App-Grund (kühler Charcoal) |
| `--bwza-bg-warm` | `#141922` | optionale Volltonebene |
| `--bwza-ink` | `#EEF1F4` | Haupttext, große Zahlen |
| `--bwza-ink-dim` | `#9AA4B0` | Sekundärtext |
| `--bwza-ink-mute` | `#6B7480` | Labels, Hints |
| `--bwza-teal` (`-deep`/`-ink`) | `#2BD4BC` / `#1FB5A0` / `#04342C` | **Primär**: CTA, aktiv, Marke (Text drauf `-ink`) |
| `--bwza-blue` | `#4D8EF7` | Info / Kategorie |
| `--bwza-gold` | `#F4B740` | „offen" / Warnung |
| `--bwza-green` | `#34D399` | Aufladung / „bestätigt" / positiv |
| `--bwza-coral` | `#FF5C61` | Schulden / Storno / Deckung negativ / „abgelehnt" |

**Kompatibilitäts-Aliase** (alte Namen → neue Werte): `--bwza-amber`→Teal,
`--bwza-rescue(-soft)`→Koralle, `--bwza-success`→Grün, `--bwza-accent`→Teal.
Bestehende `var(--bwza-*)`-Referenzen ziehen so automatisch mit.

**Kategoriales Set** (Daten-Viz / Drink-Kategorien): Teal · Blau · Gold · Grün ·
Koralle (in der Reihenfolge); 6. Farbe nur bei Bedarf, sparsam.

## Semantik (HART — Domäne)

negatives Guthaben / Schulden / Deckung negativ / Storno / abgelehnt → **Koralle** ·
Aufladung / bestätigt / positiv → **Grün** · offen / Warnung → **Gold** ·
Primär-CTA / aktiv → **Teal** · Info → **Blau**.

## Glass

- **Fläche:** `--bwza-glass` `rgba(255,255,255,0.05)` (Karten), `--bwza-glass-raise`
  `0.07` (Hero/betont), `--bwza-glass-amber` `rgba(43,212,188,0.08)` (teal-getöntes
  Akzent-/Hero-Glas).
- **Hairline-Border:** `--bwza-glass-line` `rgba(255,255,255,0.10)`.
- **ShineEdge:** obere Lichtkante `--bwza-glass-shine` `rgba(255,255,255,0.20)`
  (1px, leicht eingerückt).
- **Backdrop-Blur:** `--bwza-blur-glass` `blur(18px) saturate(120%)` (Nav/Sheet
  etwas stärker) — echter Milchglas-Effekt über dem Grund, **keine Dependency**.
- **Radien großzügig:** sm 10 / md 14 / lg 18 / xl 22 / pill 999.

## Typografie — Inter durchgehend

- **Inter** ist die einzige Display+UI-Schrift; **Fraunces ist entfernt**
  (`--bwza-font-display` = Inter).
- **Große Zahlen** (Guthaben, Hero, StatCard-Werte): **Weight 300**, leicht
  negatives Letter-Spacing.
- **Sektions-Labels:** Versalien, Letter-Spacing ~2px (`.bwza-eyebrow`), in
  Ink-mute.
- **Body/UI:** regular. **Beträge tabellarisch** (`font-variant-numeric:
  tabular-nums`, global auf `body`), in Karten rechtsbündig ausgerichtet.
- `--bwza-font-mono` (JetBrains Mono) bleibt nur für echte Code-Kontexte (derzeit
  keine).

## Primitives (token-getrieben)

`Glass` (Fläche+Blur, Tones dark/raise/amber), `ShineEdge` (Lichtkante),
`GlassButton` (primär=Teal-solid/dunkler Text, sekundär=Glass-Ghost, destruktiv=
Koralle, quiet=Text), `GlassInput`/`PasswordInput` (Teal-Fokusring), `Avatar`
(Teal-Gradient, Initialen), `StatCard` (Glass, leichte Großzahl), `StatusChip`
(tone: gold/green/coral/teal/blue/neutral), `BottomNav` (aktiv=Teal),
`ProfileDrawer`, `EmptyState` (Berg-Silhouette, teal), `Skeleton` (kühler Shimmer).

## Mobile-first

390px-Baseline, Tap-Targets ≥ `--bwza-tap` (44px), Safe-Area über der Bottom-Nav,
ausreichender Kontrast auf dem kühlen Grund.
