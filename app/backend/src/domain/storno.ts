// Gemeinsame Storno-Bausteine (Bündel 3, Einheit 3). Beide Storno-Eintrittspunkte
// — der Mitglieder-Weg (buchen.ts: Aufladung von der Mitglieder-Seite stornieren)
// und der Kassen-Weg (kasse.ts: eine Kassen-Buchung stornieren) — erzeugen für
// eine gekoppelte Aufladung/EINZAHLUNG DASSELBE Paar an Gegenbuchungen. Damit das
// nicht doppelt ausgeschrieben (und so auseinanderdriftet) wird, liegen die
// `data`-Bauer hier zentral.
//
// Storno = Gegenbuchung (kein Hard-Delete): umgekehrtes Vorzeichen, stornoVonId =
// Original. Die wechselseitige Markierung (Mitglieder-STORNO + Kassen-stornoVonId)
// macht den Doppel-Storno über BEIDE Eintrittspunkte erkennbar.

// STORNO-Zeile, die eine Mitglieder-Transaktion umkehrt.
export function transaktionStornoData(
  original: { id: string; userId: string; betragCent: number },
  opts: { erstelltVonId: string; notiz: string },
) {
  return {
    typ: 'STORNO' as const,
    userId: original.userId,
    erstelltVonId: opts.erstelltVonId,
    stornoVonId: original.id,
    betragCent: -original.betragCent,
    notiz: opts.notiz,
  };
}

// KORREKTUR-Gegenbuchung, die eine Kassen-Buchung umkehrt — gleiches Konto/
// verwalterId, umgekehrtes Vorzeichen, stornoVonId = Original.
export function kassenStornoData(
  original: { id: string; konto: string; verwalterId: string | null; betragCent: number },
  opts: { erstelltVonId: string; notiz: string },
) {
  return {
    typ: 'KORREKTUR' as const,
    konto: original.konto,
    verwalterId: original.verwalterId,
    betragCent: -original.betragCent,
    stornoVonId: original.id,
    notiz: opts.notiz,
    erstelltVonId: opts.erstelltVonId,
  };
}
