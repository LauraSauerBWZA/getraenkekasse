import { prisma } from '../db.js';

// Live-Guthaben aus Transaktionen (KONFIGURATION.md §6.1).
// Summe aller betragCent eines Users — niemals gespeichert, immer berechnet.
// Bei einem User ohne Transaktionen liefert Prisma _sum.betragCent = null,
// das normalisieren wir zu 0.
export async function computeGuthabenCent(userId: string): Promise<number> {
  const agg = await prisma.transaktion.aggregate({
    _sum: { betragCent: true },
    where: { userId },
  });
  return agg._sum.betragCent ?? 0;
}
