import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAdmin, requireAuth } from '../auth/middleware.js';
import { generateInviteToken, inviteExpiry } from '../auth/tokens.js';
import { buildInviteUrl, email } from '../email/adapter.js';
import { computeGuthabenCent } from '../domain/guthaben.js';
import { logger } from '../logger.js';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

const inviteSchema = z.object({
  email: z.string().email(),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
});

// POST /admin/invite — legt User an (oder reaktiviert) und verschickt Magic-Link
adminRouter.post('/admin/invite', async (req, res) => {
  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Ungültige Eingaben.', details: parsed.error.flatten() });

  const { email: emailInput, firstName, lastName } = parsed.data;
  const emailLower = emailInput.toLowerCase();

  const user = await prisma.user.upsert({
    where: { email: emailLower },
    update: { firstName, lastName, isActive: true },
    create: { email: emailLower, firstName, lastName },
  });

  const { clear, hash } = generateInviteToken();
  await prisma.invite.create({
    data: {
      tokenHash: hash,
      userId: user.id,
      expiresAt: inviteExpiry(),
    },
  });

  const inviteUrl = buildInviteUrl(clear);
  await email.sendInvite({ to: user.email, firstName: user.firstName, inviteUrl });

  logger.info({ userId: user.id, email: user.email }, 'Invite erzeugt.');
  return res.status(201).json({
    user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
    // Klartext-Token nur im Dev-Response zurückgeben, damit Tests/manuelles Onboarding einfacher sind
    devToken: process.env.NODE_ENV === 'production' ? undefined : clear,
  });
});

// GET /admin/users — listet aktive Mitglieder für Admin-Auswahl (z.B. Bargeld-
// Aufladung). Minimale Variante in B2e.2 — die reiche Übersicht mit Such-/
// Filter-Affordances + Inline-Korrektur kommt in B2g. Live-`guthabenCent` aus
// `computeGuthabenCent` pro User (§6.1).
adminRouter.get('/admin/users', async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      isAdmin: true,
    },
  });

  const mitglieder = await Promise.all(
    users.map(async (u) => ({
      ...u,
      guthabenCent: await computeGuthabenCent(u.id),
    })),
  );

  return res.json({ users: mitglieder });
});

// GET /admin/invites — listet alle ausgestellten Invites mit abgeleitetem Status
adminRouter.get('/admin/invites', async (_req, res) => {
  const rows = await prisma.invite.findMany({
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { email: true, firstName: true, lastName: true } } },
  });

  const now = new Date();
  const invites = rows.map((row) => {
    const status =
      row.redeemedAt !== null ? 'eingeloest' : row.expiresAt < now ? 'abgelaufen' : 'offen';
    return {
      id: row.id,
      userId: row.userId,
      email: row.user.email,
      firstName: row.user.firstName,
      lastName: row.user.lastName,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      redeemedAt: row.redeemedAt,
      status,
    };
  });

  return res.json({ invites });
});
