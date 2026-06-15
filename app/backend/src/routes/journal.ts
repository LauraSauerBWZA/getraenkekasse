import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../auth/middleware.js';

export const journalRouter = Router();

// Alles in diesem Router ist STRIKT eigene Daten (KONFIGURATION §7.4): jeder
// Endpoint nutzt req.auth.sub, NIE ein :userId-Param. Kein Admin-/Leitung-Zugriff
// auf fremde Journale — das Trinkjournal ist privat, auch vor der Leitung.
journalRouter.use(requireAuth);

// GET /me/transaktionen — eigene Transaktions-Historie, chronologisch absteigend.
// Zeigt pro Buchung den Drink-Namen (eigene Daten, Transparenz, konsistent mit
// dem DSGVO-Datenexport §9). storniert = es existiert ein STORNO, das darauf
// verweist. dabeiSeitTage aus User.createdAt für den „seit N Tagen dabei"-Footer.
journalRouter.get('/me/transaktionen', async (req, res) => {
  const userId = req.auth!.sub;

  const [user, txs] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
    prisma.transaktion.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { drink: { select: { name: true } } },
    }),
  ]);
  if (!user) return res.status(404).json({ error: 'User nicht gefunden.' });

  const stornierteIds = new Set(
    txs.filter((t) => t.typ === 'STORNO' && t.stornoVonId).map((t) => t.stornoVonId as string),
  );

  const transaktionen = txs.map((t) => ({
    id: t.id,
    typ: t.typ,
    betragCent: t.betragCent,
    notiz: t.notiz,
    drinkName: t.drink?.name ?? null,
    stornoVonId: t.stornoVonId,
    createdAt: t.createdAt,
    storniert: stornierteIds.has(t.id),
  }));

  const dabeiSeitTage = Math.floor((Date.now() - user.createdAt.getTime()) / 86_400_000);

  return res.json({ transaktionen, dabeiSeitTage });
});
