// Clientseitige Etikett-Kompression (Drink-Fotos) — OHNE Dependency, nur Canvas.
// Lädt das gewählte Bild, schneidet es zentriert quadratisch zu (1:1 Center-Crop),
// skaliert auf 400×400 und exportiert als JPEG (~0,75 Qualität) → Data-URL.
// Ergebnis ist typisch ~30–50 KB und wird als `bildDataUrl` gespeichert.

const ZIEL = 400; // Kantenlänge des Etiketts in px
const QUALITAET = 0.75; // JPEG-Qualität

export async function comprimiereEtikett(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await ladeBild(url);
    const canvas = document.createElement('canvas');
    canvas.width = ZIEL;
    canvas.height = ZIEL;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas wird nicht unterstützt.');

    // Center-Crop: die kürzere Kante bestimmt das Quadrat, mittig ausgeschnitten.
    const seite = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - seite) / 2;
    const sy = (img.naturalHeight - seite) / 2;
    ctx.drawImage(img, sx, sy, seite, seite, 0, 0, ZIEL, ZIEL);

    return canvas.toDataURL('image/jpeg', QUALITAET);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function ladeBild(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Bild konnte nicht geladen werden.'));
    img.src = src;
  });
}
