import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAdmin, requireAuth } from '../auth/middleware.js';
import { computeGuthabenCent } from '../domain/guthaben.js';
import { logger } from '../logger.js';

export const aufladungRouter = Router();

aufladungRouter.use(requireAuth, requireAdmin);

// POST /admin/aufladung/bargeld — Verwalter trägt eine Bargeld-Einzahlung
// eines Mitglieds ein. Erzeugt zwei wechselseitig verknüpfte Buchungen
// atomar (KONFIGURATION.md §6.4):
//   - Mitglieder-Transaktion: typ=AUFLADUNG_BARGELD, +X, Vermerk
//   - Kassen-Buchung:         typ=EINZAHLUNG, konto=VERWALTER,
//                             verwalterId=eingeloggter Admin, +X, Vermerk
// Vermerk ist Pflicht (§6.8). verwalterId = eingeloggter Admin — die
// Multi-Verwalter-Verteilung kommt in B2k und degeneriert hier sauber zum
// Einzelfall.
const bargeldSchema = z.object({
  userId: z.string().min(1),
  betragCent: z.number().int().positive(),
  vermerk: z.string(),
});

aufladungRouter.post('/admin/aufladung/bargeld', async (req, res) => {
  const parsed = bargeldSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: 'Ungültige Eingaben.', details: parsed.error.flatten() });
  }
  const vermerk = parsed.data.vermerk.trim();
  if (!vermerk) {
    return res.status(400).json({ error: 'Vermerk ist Pflicht.' });
  }

  const empfaenger = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!empfaenger) return res.status(404).json({ error: 'Mitglied nicht gefunden.' });
  if (!empfaenger.isActive) {
    return res.status(400).json({ error: 'Mitglied ist deaktiviert — keine Aufladung möglich.' });
  }

  const adminId = req.auth!.sub;
  const betragCent = parsed.data.betragCent;

  // Wechselseitige Verlinkung: erst die Kassen-Zeile ohne FK, dann die
  // Mitglieder-Zeile mit FK auf die Kasse, dann die Kassen-Zeile um die
  // Mitglieder-FK aktualisieren. Alles in einer atomaren $transaction.
  const result = await prisma.$transaction(async (tx) => {
    const kasse = await tx.kassenTransaktion.create({
      data: {
        typ: 'EINZAHLUNG',
        konto: 'VERWALTER',
        verwalterId: adminId,
        betragCent,
        notiz: vermerk,
        erstelltVonId: adminId,
      },
    });
    const mitglied = await tx.transaktion.create({
      data: {
        typ: 'AUFLADUNG_BARGELD',
        userId: empfaenger.id,
        erstelltVonId: adminId,
        betragCent,
        notiz: vermerk,
        kassenTransaktionId: kasse.id,
      },
    });
    const kasseVerkn = await tx.kassenTransaktion.update({
      where: { id: kasse.id },
      data: { transaktionId: mitglied.id },
    });
    return { mitglied, kasse: kasseVerkn };
  });

  const guthabenCent = await computeGuthabenCent(empfaenger.id);
  logger.info(
    {
      empfaengerId: empfaenger.id,
      adminId,
      betragCent,
      transaktionId: result.mitglied.id,
      kassenTransaktionId: result.kasse.id,
    },
    'Bargeld-Aufladung gebucht.',
  );

  return res.status(201).json({
    transaktion: result.mitglied,
    kassenTransaktion: result.kasse,
    guthabenCent,
  });
});
