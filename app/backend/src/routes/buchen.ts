import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth } from '../auth/middleware.js';
import { computeGuthabenCent } from '../domain/guthaben.js';
import { logger } from '../logger.js';

export const buchenRouter = Router();

buchenRouter.use(requireAuth);

// GET /drinks — Liste der für Mitglieder buchbaren Drinks.
// Nur isActive=true (Soft-Disable blendet im Buchen-Tab aus, behält aber
// die Drink-Referenz für historische Transaktionen). Flach + sortiert nach
// Kategorie+Name — Gruppierung übernimmt das Frontend.
buchenRouter.get('/drinks', async (_req, res) => {
  const drinks = await prisma.drink.findMany({
    where: { isActive: true },
    orderBy: [{ kategorie: 'asc' }, { name: 'asc' }],
  });
  return res.json({ drinks });
});

const kaufSchema = z.object({
  drinkId: z.string().min(1),
});

// POST /transaktionen/kauf — Selbstbuchung eines Drinks durch das Mitglied.
// preisAtKaufCent friert den aktuellen Preis ein (§5.3, §6.2). Negatives
// Guthaben blockt NICHT (§6.6) — Confirm-Sheet warnt im Frontend.
buchenRouter.post('/transaktionen/kauf', async (req, res) => {
  const parsed = kaufSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Ungültige Eingaben.', details: parsed.error.flatten() });
  }

  const drink = await prisma.drink.findUnique({ where: { id: parsed.data.drinkId } });
  if (!drink) return res.status(404).json({ error: 'Drink nicht gefunden.' });
  if (!drink.isActive) return res.status(400).json({ error: 'Drink ist nicht mehr buchbar.' });

  const userId = req.auth!.sub;
  const transaktion = await prisma.transaktion.create({
    data: {
      typ: 'KAUF',
      userId,
      erstelltVonId: userId, // Selbstbuchung
      drinkId: drink.id,
      preisAtKaufCent: drink.preisCent,
      betragCent: -drink.preisCent,
    },
  });

  const guthabenCent = await computeGuthabenCent(userId);
  logger.info(
    { userId, transaktionId: transaktion.id, drinkId: drink.id, betragCent: transaktion.betragCent },
    'Kauf gebucht.',
  );
  return res.status(201).json({ transaktion, guthabenCent });
});
