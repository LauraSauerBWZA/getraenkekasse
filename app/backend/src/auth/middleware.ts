import type { NextFunction, Request, Response } from 'express';
import { COOKIE_NAME, verifyJwt, type JwtPayload } from './jwt.js';
import { prisma } from '../db.js';

// `req.auth`-Typ kommt aus der dedizierten Augmentation in src/types/express.d.ts.

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Nicht eingeloggt.' });

  let payload: JwtPayload;
  try {
    payload = verifyJwt(token);
  } catch {
    return res.status(401).json({ error: 'Session ungültig.' });
  }

  const session = await prisma.session.findUnique({
    where: { id: payload.sid },
    include: { user: { select: { isActive: true } } },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    return res.status(401).json({ error: 'Session abgelaufen.' });
  }
  // Soft-gelöschte (inaktive) User fallen auch auf requireAuth-only-Routen durch —
  // sonst behielte ein nach dem Login entfernter User Zugriff bis Session-Ablauf
  // (Account-A). Login/Invite sperren bereits separat (auth.ts).
  if (!session.user.isActive) {
    return res.status(401).json({ error: 'Account deaktiviert.' });
  }

  req.auth = payload;
  next();
}

// Rollen werden LIVE aus der DB gelesen, nicht aus dem JWT (das trägt nur einen
// denormalisierten `isAdmin`-Claim vom Login-Zeitpunkt). So wirken Rechte-
// Änderungen (Verwalter/Leitung ernennen ODER entziehen, B2j/B2k) sofort und es
// gibt kein „entzogener Admin behält Rechte bis Token-Ablauf"-Loch. Inaktive
// User fallen überall durch.
async function ladeRolle(req: Request) {
  return prisma.user.findUnique({
    where: { id: req.auth!.sub },
    select: { isAdmin: true, isLeitung: true, isActive: true },
  });
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = await ladeRolle(req);
  if (user?.isActive && user.isAdmin) return next();
  return res.status(403).json({ error: 'Nur für Admins.' });
}

// Lesender Guard für die Kassen-Einsicht (B2j): erlaubt Admin ODER Leitung.
export async function requireAdminOrLeitung(req: Request, res: Response, next: NextFunction) {
  const user = await ladeRolle(req);
  if (user?.isActive && (user.isAdmin || user.isLeitung)) return next();
  return res.status(403).json({ error: 'Nur für Admins oder Leitung.' });
}
