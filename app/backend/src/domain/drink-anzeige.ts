// Anzeige-Helper für Drinks (Domain-Layer). Kanonische, unit-getestete Quelle —
// das Frontend (lib/api.ts) spiegelt `formatVolumen` 1:1 für die Subzeile-Anzeige
// (etabliertes Mirror-Muster wie STORNO_FENSTER_MS in Buchen.tsx). Bewusst ICU-
// unabhängig (kein toLocaleString) → deterministisch unter Node im Test.

// Gebindegröße in Millilitern → deutsche Liter-Anzeige.
//   500 → "0,5 l", 330 → "0,33 l", 200 → "0,2 l", 1000 → "1 l", 1500 → "1,5 l".
// Max. 2 Nachkommastellen, nachlaufende Nullen entfernt, deutsches Komma, "l"-Suffix.
export function formatVolumen(ml: number): string {
  const liter = ml / 1000;
  let s = liter.toFixed(2); // "0.50" | "0.33" | "1.00" | "0.20"
  s = s.replace(/\.?0+$/, ''); // "0.5"  | "0.33" | "1"    | "0.2"
  s = s.replace('.', ','); // deutsches Komma
  return `${s} l`;
}
