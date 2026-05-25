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
