import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { hashToken } from '../auth/tokens.js';
import { COOKIE_NAME, cookieOptions, sessionExpiry, signJwt } from '../auth/jwt.js';
import { requireAuth } from '../auth/middleware.js';
import { logger } from '../logger.js';

export const authRouter = Router();

function publicUser(u: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  guthaben: number;
  isAdmin: boolean;
  isActive: boolean;
}) {
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    guthabenCent: u.guthaben,
    isAdmin: u.isAdmin,
    isActive: u.isActive,
  };
}

async function openSession(res: import('express').Response, userId: string, isAdmin: boolean) {
  const session = await prisma.session.create({
    data: { userId, expiresAt: sessionExpiry() },
  });
  const token = signJwt({ sub: userId, sid: session.id, isAdmin });
  res.cookie(COOKIE_NAME, token, cookieOptions());
}

// ─── POST /auth/invite-redeem ────────────────────────────────────────
const redeemSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, 'Passwort muss mindestens 8 Zeichen haben.'),
});

authRouter.post('/auth/invite-redeem', async (req, res) => {
  const parsed = redeemSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Ungültige Eingaben.', details: parsed.error.flatten() });
  }
  const { token, password } = parsed.data;
  const tokenHash = hashToken(token);

  const invite = await prisma.inviteToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!invite) return res.status(400).json({ error: 'Magic-Link unbekannt.' });
  if (invite.redeemedAt) return res.status(400).json({ error: 'Magic-Link wurde bereits genutzt.' });
  if (invite.expiresAt < new Date()) return res.status(400).json({ error: 'Magic-Link abgelaufen.' });
  if (!invite.user.isActive) return res.status(403).json({ error: 'Account deaktiviert.' });

  const passwordHash = await hashPassword(password);

  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: invite.userId },
      data: { passwordHash },
    });
    await tx.inviteToken.update({
      where: { id: invite.id },
      data: { redeemedAt: new Date() },
    });
    // alle anderen offenen Invites für diesen User entwerten
    await tx.inviteToken.updateMany({
      where: { userId: invite.userId, redeemedAt: null, id: { not: invite.id } },
      data: { redeemedAt: new Date() },
    });
    return updated;
  });

  await openSession(res, user.id, user.isAdmin);
  logger.info({ userId: user.id }, 'Invite eingelöst, Session geöffnet.');
  return res.json({ user: publicUser(user) });
});

// ─── POST /auth/login ────────────────────────────────────────────────
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post('/auth/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Ungültige Eingaben.' });

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

  // Generic message für alle Fehlerfälle (kein User-Enumeration-Leak)
  const fail = () => res.status(401).json({ error: 'Email oder Passwort falsch.' });

  if (!user || !user.passwordHash) return fail();
  if (!user.isActive) return res.status(403).json({ error: 'Account deaktiviert.' });

  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok) return fail();

  await openSession(res, user.id, user.isAdmin);
  return res.json({ user: publicUser(user) });
});

// ─── GET /auth/me ────────────────────────────────────────────────────
authRouter.get('/auth/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.sub } });
  if (!user) return res.status(404).json({ error: 'User nicht gefunden.' });
  return res.json({ user: publicUser(user) });
});

// ─── POST /auth/logout ───────────────────────────────────────────────
authRouter.post('/auth/logout', requireAuth, async (req, res) => {
  await prisma.session.update({
    where: { id: req.auth!.sid },
    data: { revokedAt: new Date() },
  });
  res.clearCookie(COOKIE_NAME, { path: '/' });
  return res.json({ ok: true });
});
