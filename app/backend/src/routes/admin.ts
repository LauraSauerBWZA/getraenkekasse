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

// GET /admin/users/:id — Mitglied-Detail (B2g): Stammdaten + Live-guthabenCent
// + Transaktionshistorie (jüngste zuerst). Pro Transaktion zusätzlich:
//   - drinkName: Name des gebuchten Drinks (nur bei KAUF, sonst null)
//   - storniert: es existiert bereits eine STORNO-Zeile mit stornoVonId=dieser
//   - stornierbar: typ!=='STORNO' && !storniert — damit die UI Doppel-Stornos
//     und Storno-von-STORNO gar nicht erst anbietet (Backend blockt es ohnehin).
adminRouter.get('/admin/users/:id', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      isAdmin: true,
      isLeitung: true,
      isActive: true,
    },
  });
  if (!user) return res.status(404).json({ error: 'Mitglied nicht gefunden.' });

  const txs = await prisma.transaktion.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    include: { drink: { select: { name: true } } },
  });

  // Menge der Original-IDs, auf die schon eine STORNO-Zeile verweist.
  const stornierteIds = new Set(
    txs
      .filter((t) => t.typ === 'STORNO' && t.stornoVonId)
      .map((t) => t.stornoVonId as string),
  );

  const transaktionen = txs.map((t) => {
    const storniert = stornierteIds.has(t.id);
    return {
      id: t.id,
      typ: t.typ,
      betragCent: t.betragCent,
      notiz: t.notiz,
      drinkName: t.drink?.name ?? null,
      stornoVonId: t.stornoVonId,
      createdAt: t.createdAt,
      storniert,
      stornierbar: t.typ !== 'STORNO' && !storniert,
    };
  });

  const guthabenCent = await computeGuthabenCent(user.id);
  return res.json({ user: { ...user, guthabenCent }, transaktionen });
});

// POST /admin/korrektur — manuelle Guthaben-Korrektur eines Mitglieds (B2g, §4).
// Legt NUR eine Mitglieder-Transaktion an (typ=KORREKTUR), bewusst OHNE
// gekoppelte Kassen-Buchung: eine Korrektur verändert absichtlich die Deckung;
// reales Geld bucht der Verwalter separat auf Kassen-Ebene (B2i). Konsistent mit
// „Buchen bewegt kein Kassengeld".
// betragCent: ganzzahlig, ≠ 0, darf negativ sein (Korrektur nach unten, §6.6).
// notiz: Pflicht (§5.3). Live-Saldo (§6.1) verrechnet die Korrektur automatisch.
const korrekturSchema = z.object({
  userId: z.string().min(1),
  betragCent: z.number().int(),
  notiz: z.string(),
});

adminRouter.post('/admin/korrektur', async (req, res) => {
  const parsed = korrekturSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: 'Ungültige Eingaben.', details: parsed.error.flatten() });
  }
  const betragCent = parsed.data.betragCent;
  if (betragCent === 0) {
    return res.status(400).json({ error: 'Korrektur-Betrag darf nicht 0 sein.' });
  }
  const notiz = parsed.data.notiz.trim();
  if (!notiz) {
    return res.status(400).json({ error: 'Notiz ist bei einer Korrektur Pflicht.' });
  }

  const mitglied = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!mitglied) return res.status(404).json({ error: 'Mitglied nicht gefunden.' });
  if (!mitglied.isActive) {
    return res.status(400).json({ error: 'Mitglied ist deaktiviert — keine Korrektur möglich.' });
  }

  const adminId = req.auth!.sub;
  const transaktion = await prisma.transaktion.create({
    data: {
      typ: 'KORREKTUR',
      userId: mitglied.id,
      erstelltVonId: adminId,
      betragCent,
      notiz,
    },
  });

  const guthabenCent = await computeGuthabenCent(mitglied.id);
  logger.info(
    { mitgliedId: mitglied.id, adminId, betragCent, transaktionId: transaktion.id },
    'Guthaben-Korrektur gebucht.',
  );
  return res.status(201).json({ transaktion, guthabenCent });
});
