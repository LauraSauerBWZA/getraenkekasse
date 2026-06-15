import type { NextFunction, Request, Response } from 'express';
import { COOKIE_NAME, verifyJwt, type JwtPayload } from './jwt.js';
import { prisma } from '../db.js';

declare module 'express-serve-static-core' {
  interface Request {
    auth?: JwtPayload;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Nicht eingeloggt.' });

  let payload: JwtPayload;
  try {
    payload = verifyJwt(token);
  } catch {
    return res.status(401).json({ error: 'Session ungültig.' });
  }

  const session = await prisma.session.findUnique({ where: { id: payload.sid } });
  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    return res.status(401).json({ error: 'Session abgelaufen.' });
  }

  req.auth = payload;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.auth?.isAdmin) return res.status(403).json({ error: 'Nur für Admins.' });
  next();
}

// Lesender Guard für die Kassen-Einsicht (B2j): erlaubt Admin ODER Leitung.
// Das JWT trägt nur `isAdmin` — `isLeitung` wird daher per DB-Lookup geprüft,
// wenn der User kein Admin ist. Vorteil: ein frisch vergebenes Leitung-Recht
// wirkt ohne Re-Login (kein Token-Refresh nötig). Inaktive User fallen durch.
export async function requireAdminOrLeitung(req: Request, res: Response, next: NextFunction) {
  if (req.auth?.isAdmin) return next();
  const user = await prisma.user.findUnique({
    where: { id: req.auth!.sub },
    select: { isLeitung: true, isActive: true },
  });
  if (user?.isLeitung && user.isActive) return next();
  return res.status(403).json({ error: 'Nur für Admins oder Leitung.' });
}
