import { Router } from 'express';
import { requireAuth } from '../auth/middleware.js';
import { COOKIE_NAME } from '../auth/jwt.js';
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

// Datenexport ist seit „Export admin-exklusiv" KEINE Mitglieder-Funktion mehr.
// Der frühere GET /me/export ist entfernt — Export läuft ausschließlich über die
// Admin-Routen GET /admin/users/:id/export (einzeln) und GET /admin/export
// (gesamt), beide hinter requireAdmin (routes/admin.ts, domain/export.ts).
