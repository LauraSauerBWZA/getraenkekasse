import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../auth/middleware.js';
import { COOKIE_NAME } from '../auth/jwt.js';
import { computeGuthabenCent } from '../domain/guthaben.js';
import { istLetzterAktiverAdmin, softDeleteUser } from '../domain/account.js';
import { logger } from '../logger.js';

export const accountRouter = Router();

accountRouter.use(requireAuth);

// DELETE /me — Konto-Selbstlöschung (Account-A §3.3). Soft-Delete (isActive=false)
// auf den EIGENEN User über den geteilten Kern; danach Session beendet (im Kern
// revoked) + Cookie gelöscht → sofort ausgeloggt, kein Login mehr.
// Letzter-Admin-Schutz greift auch hier: der letzte aktive Verwalter kann sich
// nicht selbst löschen (sonst stünde die App ohne Verwalter da).
accountRouter.delete('/me', async (req, res) => {
  const userId = req.auth!.sub;

  if (await istLetzterAktiverAdmin(userId)) {
    return res.status(400).json({
      error: 'Du bist der letzte aktive Verwalter — übergib die Verwaltung zuerst.',
    });
  }

  await softDeleteUser(userId);
  res.clearCookie(COOKIE_NAME, { path: '/' });
  logger.info({ userId }, 'Konto selbst gelöscht (Soft-Delete).');
  return res.json({ ok: true });
});

// GET /me/export — Datenexport (Account-A §3.4, DSGVO §9). NUR eigene Daten als
// JSON: Profil + eigene Transaktionen (inkl. Drink-Name) + eigene Aufladungs-
// Anfragen. BEWUSST NICHT: fremde Daten, aggregierte App-Statistiken, Kassen-
// Daten (§9). Frontend lädt das als Datei herunter.
accountRouter.get('/me/export', async (req, res) => {
  const userId = req.auth!.sub;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      isAdmin: true,
      isLeitung: true,
      createdAt: true,
    },
  });
  if (!user) return res.status(404).json({ error: 'User nicht gefunden.' });

  const [txs, anfragen, guthabenCent] = await Promise.all([
    prisma.transaktion.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { drink: { select: { name: true } } },
    }),
    prisma.aufladungsAnfrage.findMany({
      where: { userId },
      orderBy: { requestedAt: 'desc' },
      select: {
        id: true,
        betragCent: true,
        status: true,
        requestedAt: true,
        decidedAt: true,
        adminNotiz: true,
      },
    }),
    computeGuthabenCent(userId),
  ]);

  const transaktionen = txs.map((t) => ({
    id: t.id,
    typ: t.typ,
    betragCent: t.betragCent,
    drinkName: t.drink?.name ?? null,
    notiz: t.notiz,
    createdAt: t.createdAt,
  }));

  const exportData = {
    exportiertAm: new Date().toISOString(),
    hinweis:
      'Eigene Daten aus der Bergwacht-Getränkekasse. Keine fremden, aggregierten oder Kassen-Daten enthalten.',
    profil: {
      vorname: user.firstName,
      nachname: user.lastName,
      email: user.email,
      rollen: { admin: user.isAdmin, leitung: user.isLeitung },
      mitgliedSeit: user.createdAt,
      guthabenCent,
    },
    transaktionen,
    aufladungsAnfragen: anfragen,
  };

  // Als Download-freundliche JSON-Datei ausliefern.
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="getraenkekasse-export.json"');
  return res.send(JSON.stringify(exportData, null, 2));
});
