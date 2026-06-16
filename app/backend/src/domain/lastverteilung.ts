import type { User } from '@prisma/client';
import { prisma } from '../db.js';
import { logger } from '../logger.js';

// Lastverteilung „geringste Schuld zuerst" (KONFIGURATION §6.9), live berechnet,
// kein gespeicherter Cursor. Aus routes/aufladung.ts extrahiert (Cleanup), damit
// die Neuzuweisung beim Verwalter-Wegfall (Demote/Remove) dieselbe Logik nutzt.

// Effektive gehaltene Summe eines Verwalters: Verwalter-Topf
// (SUM kassenTransaktion WHERE konto=VERWALTER) PLUS Summe seiner noch OFFENEN
// Anfragen. Das Mitzählen offener Anfragen verhindert Klumpung.
export async function effektiveLastCent(verwalterId: string): Promise<number> {
  const [topf, offen] = await Promise.all([
    prisma.kassenTransaktion.aggregate({
      _sum: { betragCent: true },
      where: { konto: 'VERWALTER', verwalterId },
    }),
    prisma.aufladungsAnfrage.aggregate({
      _sum: { betragCent: true },
      where: { zugewiesenerVerwalterId: verwalterId, status: 'OFFEN' },
    }),
  ]);
  return (topf._sum.betragCent ?? 0) + (offen._sum.betragCent ?? 0);
}

// Der am wenigsten haltende Kandidat (Liste bereits für den Tie-Break sortiert —
// strikter Min-Scan behält bei Gleichstand den ersten). Leere Liste → null.
export async function leastLoaded(candidates: User[]): Promise<User | null> {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  const mitSumme = await Promise.all(
    candidates.map(async (v) => ({ v, effektiv: await effektiveLastCent(v.id) })),
  );
  let best = mitSumme[0];
  for (const e of mitSumme.slice(1)) {
    if (e.effektiv < best.effektiv) best = e;
  }
  return best.v;
}

// Member-facing: zuständiger Verwalter für eine NEUE PayPal-Anfrage — nur aktive
// Admins MIT nicht-leerem paypalMeLink (ohne Link gibt es nichts zum Überweisen).
export async function ermittleZustaendigenVerwalter(): Promise<User | null> {
  const verwalter = await prisma.user.findMany({
    where: { isAdmin: true, isActive: true, paypalMeLink: { not: null } },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  });
  const waehlbar = verwalter.filter((v) => v.paypalMeLink && v.paypalMeLink.trim() !== '');
  return leastLoaded(waehlbar);
}

// Offene PayPal-Anfragen eines wegfallenden Verwalters (Demote B2k oder Remove
// Account-A) dem least-loaded aktiven Verwalter neu zuweisen (status bleibt OFFEN
// → bleibt bestätigbar). Reassign-Ziel = aktiver Admin ≠ Wegfallender, OHNE
// Link-Pflicht (Hauptziel: aktionierbar machen; ein Link kann später gepflegt
// werden). Letzter-Admin-Schutz garantiert beim Demote/Remove ≥1 anderen aktiven
// Admin → es gibt immer ein Ziel. Für Nicht-Verwalter sind es 0 Zeilen → no-op.
// Gibt die Anzahl neu zugewiesener Anfragen zurück.
export async function reassignOffeneAnfragen(verwalterId: string): Promise<number> {
  const offene = await prisma.aufladungsAnfrage.count({
    where: { zugewiesenerVerwalterId: verwalterId, status: 'OFFEN' },
  });
  if (offene === 0) return 0;

  const kandidaten = await prisma.user.findMany({
    where: { isAdmin: true, isActive: true, id: { not: verwalterId } },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  });
  const ziel = await leastLoaded(kandidaten);
  if (!ziel) {
    // Sollte wegen Letzter-Admin-Schutz nicht eintreten — defensiv kein Crash.
    logger.warn(
      { verwalterId, offene },
      'Kein Reassign-Ziel für offene Anfragen — Anfragen bleiben beim Wegfallenden.',
    );
    return 0;
  }

  await prisma.aufladungsAnfrage.updateMany({
    where: { zugewiesenerVerwalterId: verwalterId, status: 'OFFEN' },
    data: { zugewiesenerVerwalterId: ziel.id },
  });
  logger.info(
    { vonVerwalterId: verwalterId, zuVerwalterId: ziel.id, anzahl: offene },
    'Offene PayPal-Anfragen neu zugewiesen (Verwalter-Wegfall).',
  );
  return offene;
}
