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

// Summe ALLER Mitglieder-Guthaben als eine Zahl (KONFIGURATION.md §6.8) —
// = was die Kasse den Mitgliedern insgesamt schuldet. Eingang in die Deckung:
// Deckung = Vereinsvermögen − diese Summe. Keine Einzelsalden (DSGVO/Leitung).
export async function computeMitgliederGuthabenSummeCent(): Promise<number> {
  const agg = await prisma.transaktion.aggregate({ _sum: { betragCent: true } });
  return agg._sum.betragCent ?? 0;
}
