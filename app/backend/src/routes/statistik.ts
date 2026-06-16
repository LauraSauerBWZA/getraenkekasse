import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAdminOrLeitung, requireAuth } from '../auth/middleware.js';

export const statistikRouter = Router();

// Read-only Sortenstatistik für Admin UND Leitung (B2j-Guard, DB-backed).
statistikRouter.use(requireAuth, requireAdminOrLeitung);

// Rollierende Zeitfenster in Tagen. Default `monat`, auch bei ungültigem/
// fehlendem Query-Param (z.enum(...).catch).
const ZEITRAUM_TAGE = { woche: 7, monat: 30, quartal: 90 } as const;
const zeitraumSchema = z.enum(['woche', 'monat', 'quartal']).catch('monat');

// GET /statistik/sorten?zeitraum=woche|monat|quartal
//
// App-weit anonym aggregiert (KONFIGURATION §7.5, §9, §11): pro Drink Anzahl
// gültiger Käufe + Umsatz (Σ eingefrorener preisAtKaufCent). Stornierte Käufe
// (ein STORNO verweist via stornoVonId darauf) sind ausgeschlossen.
//
// DSGVO HART: KEIN userId in Query oder Antwort, KEINE Gruppierung nach User,
// KEINE Top-Konsumenten — nur Drink-Totale. Die Käufe-Query selektiert bewusst
// nur id/drinkId/preisAtKaufCent.
statistikRouter.get('/statistik/sorten', async (req, res) => {
  const zeitraum = zeitraumSchema.parse(req.query.zeitraum);
  const seit = new Date(Date.now() - ZEITRAUM_TAGE[zeitraum] * 24 * 60 * 60 * 1000);

  // Alle Käufe im Fenster (mit Drink). Kein userId — bewusst. Käufe soft-
  // gelöschter User (isActive=false) sind ausgeschlossen (§11, Account-A):
  // Ausschluss über die User-Relation, kein Transaktion.deletedAt.
  const kaeufe = await prisma.transaktion.findMany({
    where: {
      typ: 'KAUF',
      drinkId: { not: null },
      createdAt: { gte: seit },
      user: { isActive: true },
    },
    select: { id: true, drinkId: true, preisAtKaufCent: true },
  });

  // Stornierte Käufe ausschließen — ein KAUF ist storniert, sobald ein STORNO
  // auf ihn verweist (unabhängig vom Storno-Zeitpunkt).
  const kaufIds = kaeufe.map((k) => k.id);
  const stornos =
    kaufIds.length > 0
      ? await prisma.transaktion.findMany({
          where: { typ: 'STORNO', stornoVonId: { in: kaufIds } },
          select: { stornoVonId: true },
        })
      : [];
  const stornierte = new Set(stornos.map((s) => s.stornoVonId));

  // Aggregation pro Drink.
  const proDrink = new Map<string, { anzahl: number; umsatzCent: number }>();
  let gesamtAnzahl = 0;
  let gesamtUmsatzCent = 0;
  for (const k of kaeufe) {
    if (stornierte.has(k.id) || !k.drinkId) continue;
    const preis = k.preisAtKaufCent ?? 0;
    const cur = proDrink.get(k.drinkId) ?? { anzahl: 0, umsatzCent: 0 };
    cur.anzahl += 1;
    cur.umsatzCent += preis;
    proDrink.set(k.drinkId, cur);
    gesamtAnzahl += 1;
    gesamtUmsatzCent += preis;
  }

  // Drink-Stammdaten (auch inaktive — können im Fenster verkauft worden sein).
  const drinkIds = [...proDrink.keys()];
  const drinks =
    drinkIds.length > 0
      ? await prisma.drink.findMany({
          where: { id: { in: drinkIds } },
          select: { id: true, name: true, icon: true, kategorie: true },
        })
      : [];
  const drinkMap = new Map(drinks.map((d) => [d.id, d]));

  const sorten = drinkIds
    .map((id) => {
      const d = drinkMap.get(id);
      const agg = proDrink.get(id)!;
      return {
        drinkId: id,
        name: d?.name ?? '—',
        icon: d?.icon ?? null,
        kategorie: d?.kategorie ?? null,
        anzahl: agg.anzahl,
        umsatzCent: agg.umsatzCent,
      };
    })
    .sort((a, b) => b.anzahl - a.anzahl || b.umsatzCent - a.umsatzCent);

  return res.json({ zeitraum, seit, sorten, gesamtAnzahl, gesamtUmsatzCent });
});
