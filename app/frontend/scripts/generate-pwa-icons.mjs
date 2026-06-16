// PWA-Icon-Generator (B6, dev-only — Teil der PWA-Freigabe).
// Rendert die BergMark-Geometrie (aus components/primitives.tsx) auf dunklem
// Charcoal-Grund (#0D1116, = --bwza-bg) zu PNGs in verschiedenen Größen.
// Maskable bekommt mehr Padding (Safe-Zone), damit Plattform-Masken nicht clippen.
//
// Aufruf:  node scripts/generate-pwa-icons.mjs
// Die erzeugten PNGs + favicon.svg werden committet (public/).
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, '..', 'public');
mkdirSync(publicDir, { recursive: true });

const BG = '#0D1116'; // --bwza-bg (kühler Charcoal)
const TEAL = '#2BD4BC'; // --bwza-teal

// BergMark in viewBox 0..32 (1:1 aus der React-Komponente).
const BERGMARK = `
  <path d="M16 3 L29 27 L3 27 Z" stroke="${TEAL}" stroke-width="1.6" stroke-linejoin="round" fill="none" />
  <path d="M9.5 22 L13 16 L16.5 20 L20 14 L24 22 Z" fill="${TEAL}" fill-opacity="0.35" />
  <path d="M14.5 11 L16 8 L17.5 11 Z" fill="${TEAL}" />
  <circle cx="16" cy="15.5" r="1.3" fill="${TEAL}" />
`;

// Baut ein quadratisches Icon-SVG der Kantenlänge `size`. `fraction` = Anteil der
// Fläche, den die Marke einnimmt (Rest ist Charcoal-Padding). `glow` legt einen
// dezenten Teal-Schimmer oben an (wie der App-Hintergrund body::before).
function iconSvg(size, fraction, glow = true) {
  const mark = fraction * size;
  const offset = (size - mark) / 2;
  const scale = mark / 32;
  const glowDef = glow
    ? `<radialGradient id="g" cx="50%" cy="0%" r="80%">
         <stop offset="0%" stop-color="${TEAL}" stop-opacity="0.16" />
         <stop offset="60%" stop-color="${TEAL}" stop-opacity="0" />
       </radialGradient>`
    : '';
  const glowRect = glow ? `<rect width="${size}" height="${size}" fill="url(#g)" />` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>${glowDef}</defs>
    <rect width="${size}" height="${size}" fill="${BG}" />
    ${glowRect}
    <g transform="translate(${offset} ${offset}) scale(${scale})">${BERGMARK}</g>
  </svg>`;
}

async function png(name, size, fraction, glow = true) {
  const buf = await sharp(Buffer.from(iconSvg(size, fraction, glow))).png().toBuffer();
  writeFileSync(join(publicDir, name), buf);
  console.log(`  ${name}  (${size}×${size}, mark ${Math.round(fraction * 100)}%)`);
}

// Vektor-Favicon (kein Raster nötig — Browser skaliert SVG).
function writeFavicon() {
  const svg = iconSvg(32, 0.84, false);
  writeFileSync(join(publicDir, 'favicon.svg'), svg);
  console.log('  favicon.svg  (vektor)');
}

console.log('PWA-Icons erzeugen →', publicDir);
writeFavicon();
// Standard-Icons: Marke ~64% (angenehmes Padding), any-purpose.
await png('pwa-192x192.png', 192, 0.64);
await png('pwa-512x512.png', 512, 0.64);
// Maskable: Safe-Zone — Marke nur ~54%, Charcoal full-bleed, nichts wird geclippt.
await png('maskable-512x512.png', 512, 0.54);
// Apple-Touch: iOS rundet selbst, etwas weniger Padding; kein Glow für klare Kante.
await png('apple-touch-icon-180x180.png', 180, 0.66, false);
console.log('fertig.');
