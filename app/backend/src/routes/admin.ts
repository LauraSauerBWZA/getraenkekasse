import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAdmin, requireAuth } from '../auth/middleware.js';
import { generateInviteToken, inviteExpiry } from '../auth/tokens.js';
import { buildInviteUrl, email } from '../email/adapter.js';
import { computeGuthabenCent } from '../domain/guthaben.js';
import { istLetzterAktiverAdmin, softDeleteUser, verwalterTopfCent } from '../domain/account.js';
import { reassignOffeneAnfragen } from '../domain/lastverteilung.js';
import { logger } from '../logger.js';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

const inviteSchema = z.object({
  email: z.string().email(),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  // Account-B: direkt mit Rolle einladen (Default false). Wird beim Anlegen am
  // User gesetzt — der Invite selbst trägt keine Rollen (schlankes Modell).
  isAdmin: z.boolean().optional(),
  isLeitung: z.boolean().optional(),
});

// POST /admin/invite — legt User an (oder reaktiviert) und verschickt Magic-Link
adminRouter.post('/admin/invite', async (req, res) => {
  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Ungültige Eingaben.', details: parsed.error.flatten() });

  const { email: emailInput, firstName, lastName, isAdmin = false, isLeitung = false } = parsed.data;
  const emailLower = emailInput.toLowerCase();

  // Rolle NUR beim Neuanlegen (create) setzen. Bei Re-Invite eines bestehenden
  // Users bleibt dessen Rolle unberührt (kein versehentliches Demoten — Rollen-
  // wechsel läuft über den Detail-Toggle, B2k).
  const user = await prisma.user.upsert({
    where: { email: emailLower },
    update: { firstName, lastName, isActive: true },
    create: { email: emailLower, firstName, lastName, isAdmin, isLeitung },
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
    // Klartext-Token IMMER (auch in Prod) an den eingeloggten, requireAdmin-geschützten
    // Admin zurückgeben: Es gibt KEINEN E-Mail-Versand (Resend gestrichen) → die Anzeige
    // des Links in der App ist der einzige Weg, den Magic-Link an den Admin zu geben, der
    // ihn selbst an die Person weiterleitet. Token wird nur als SHA-256-Hash gespeichert,
    // läuft nach 7 Tagen ab.
    devToken: clear,
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

// DELETE /admin/users/:id — Mitglied entfernen (Account-A, §6.7). Soft-Delete
// (isActive=false) über den geteilten Kern: kein Login mehr, Kasse entkoppelt
// (KassenTransaktion bleibt, Bestand unverfälscht), raus aus Statistik/Mitglieder-
// Summe/Deckung. requireAdmin (adminRouter-Gate).
//   - Letzter aktiver Admin → 400 (App darf nie ohne Verwalter dastehen, B2k).
//   - Verwalter-Topf ≠ 0 → blockiert NICHT, gibt aber eine Warnung zurück
//     (Prozess-Hinweis „Topf vorher ausgleichen/übergeben", §6.7).
adminRouter.delete('/admin/users/:id', async (req, res) => {
  const ziel = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { id: true, isActive: true, isAdmin: true },
  });
  if (!ziel) return res.status(404).json({ error: 'Mitglied nicht gefunden.' });
  if (!ziel.isActive) return res.status(400).json({ error: 'Mitglied ist bereits entfernt.' });

  if (await istLetzterAktiverAdmin(ziel.id)) {
    return res.status(400).json({ error: 'Der letzte aktive Verwalter kann nicht entfernt werden.' });
  }

  const topfCent = ziel.isAdmin ? await verwalterTopfCent(ziel.id) : 0;
  await softDeleteUser(ziel.id);

  const warnung =
    topfCent !== 0
      ? `Achtung: Der Verwalter-Topf war nicht ausgeglichen (${topfCent} Cent). Bitte separat klären (ausgleichen/übergeben).`
      : null;

  logger.info({ mitgliedId: ziel.id, adminId: req.auth!.sub, topfCent }, 'Mitglied entfernt (Soft-Delete).');
  return res.json({ ok: true, warnung });
});

// POST /admin/users/:id/reset-password — Admin-Passwort-Reset (Account-B).
// Erzeugt für den BESTEHENDEN, aktiven User einen neuen einmaligen Token-Invite
// (gleiche Magic-Link-Infra) und gibt den Klartext-Token zurück; das Frontend
// baut daraus den kopierbaren Reset-Link (LAN-sicher, wie beim Invite). Eingelöst
// wird über die bestehende /auth/invite-redeem-Route → setzt das neue Passwort.
//   - Altes Passwort bleibt gültig bis zum Einlösen (passwordHash unangetastet).
//   - isActive unberührt (Reset reaktiviert nicht); inaktiv → 400, unbekannt → 404.
// Kein Email-Versand (Resend gestrichen) — Admin leitet den Link selbst weiter.
adminRouter.post('/admin/users/:id/reset-password', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { id: true, email: true, firstName: true, isActive: true },
  });
  if (!user) return res.status(404).json({ error: 'Mitglied nicht gefunden.' });
  if (!user.isActive) {
    return res.status(400).json({ error: 'Mitglied ist deaktiviert — kein Passwort-Reset möglich.' });
  }

  const { clear, hash } = generateInviteToken();
  await prisma.invite.create({
    data: { tokenHash: hash, userId: user.id, expiresAt: inviteExpiry() },
  });

  const inviteUrl = buildInviteUrl(clear);
  await email.sendInvite({ to: user.email, firstName: user.firstName, inviteUrl });

  logger.info({ userId: user.id, adminId: req.auth!.sub }, 'Passwort-Reset-Link erzeugt.');
  return res.status(201).json({
    user: { id: user.id, email: user.email, firstName: user.firstName },
    // Klartext-Token IMMER zurückgeben (wie /admin/invite) — kein E-Mail-Versand, der Admin
    // braucht den Link auch in Prod, um ihn selbst weiterzuleiten. Nur Hash gespeichert, 7-Tage-Ablauf.
    devToken: clear,
  });
});

// PATCH /admin/users/:id/leitung — Leitung-Recht vergeben/entziehen (B2j, §4).
// Setzt NUR `isLeitung`. Verwalter ernennen (`isAdmin`) ist bewusst B2k und hier
// nicht möglich. requireAdmin (adminRouter-Gate).
const leitungSchema = z.object({ isLeitung: z.boolean() });

adminRouter.patch('/admin/users/:id/leitung', async (req, res) => {
  const parsed = leitungSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: 'Ungültige Eingaben.', details: parsed.error.flatten() });
  }

  const ziel = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!ziel) return res.status(404).json({ error: 'Mitglied nicht gefunden.' });

  const user = await prisma.user.update({
    where: { id: ziel.id },
    data: { isLeitung: parsed.data.isLeitung },
    select: { id: true, firstName: true, lastName: true, isAdmin: true, isLeitung: true },
  });

  logger.info(
    { mitgliedId: user.id, isLeitung: user.isLeitung, adminId: req.auth!.sub },
    'Leitung-Recht gesetzt.',
  );
  return res.json({ user });
});

// PATCH /admin/users/:id/admin — Verwalter-Recht (isAdmin) vergeben/entziehen
// (B2k, §4). requireAdmin (adminRouter-Gate). Setzt NUR `isAdmin`.
// Letzter-Admin-Schutz: das Entziehen scheitert mit 400, wenn das Ziel der
// letzte aktive Admin ist — die App darf nie ohne Verwalter dastehen. Sich
// selbst entziehen ist erlaubt, solange ein weiterer aktiver Admin bleibt.
const adminToggleSchema = z.object({ isAdmin: z.boolean() });

adminRouter.patch('/admin/users/:id/admin', async (req, res) => {
  const parsed = adminToggleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: 'Ungültige Eingaben.', details: parsed.error.flatten() });
  }

  const ziel = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!ziel) return res.status(404).json({ error: 'Mitglied nicht gefunden.' });

  if (parsed.data.isAdmin === false && ziel.isAdmin && ziel.isActive) {
    const aktiveAdmins = await prisma.user.count({ where: { isAdmin: true, isActive: true } });
    if (aktiveAdmins <= 1) {
      return res
        .status(400)
        .json({ error: 'Der letzte aktive Verwalter kann nicht entzogen werden.' });
    }
  }

  const wirdDemotet = parsed.data.isAdmin === false && ziel.isAdmin;

  const user = await prisma.user.update({
    where: { id: ziel.id },
    data: { isAdmin: parsed.data.isAdmin },
    select: { id: true, firstName: true, lastName: true, isAdmin: true, isLeitung: true },
  });

  // Beim Entzug des Verwalter-Rechts: offene PayPal-Anfragen, die dem jetzt
  // Ex-Verwalter zugewiesen waren, dem least-loaded verbliebenen Verwalter neu
  // zuweisen (Cleanup) — sonst bleiben sie unbestätigbar. Letzter-Admin-Schutz
  // (oben) garantiert ein Ziel.
  if (wirdDemotet) {
    await reassignOffeneAnfragen(user.id);
  }

  logger.info(
    { mitgliedId: user.id, isAdmin: user.isAdmin, adminId: req.auth!.sub },
    'Verwalter-Recht gesetzt.',
  );
  return res.json({ user });
});

// PATCH /admin/me/paypal — der eingeloggte Verwalter pflegt SEINEN eigenen
// paypal.me-Link (§3, B2k). Immer nur der eigene (req.auth.sub), nie fremde.
// Gespeichert wird der reine Handle (ohne protocol / „paypal.me/"), damit das
// Frontend `paypal.me/{handle}/{betrag}` bauen kann. Leeren via null/"" → null.
function normalizePaypalHandle(raw: string | null): string | null {
  if (raw == null) return null;
  const s = raw
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^paypal\.me\//i, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
  return s || null;
}

const paypalSchema = z.object({ paypalMeLink: z.string().nullable() });

adminRouter.patch('/admin/me/paypal', async (req, res) => {
  const parsed = paypalSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: 'Ungültige Eingaben.', details: parsed.error.flatten() });
  }
  const handle = normalizePaypalHandle(parsed.data.paypalMeLink);
  if (handle && !/^[A-Za-z0-9._-]+$/.test(handle)) {
    return res
      .status(400)
      .json({ error: 'Ungültiger paypal.me-Link — nur der Nutzername bzw. paypal.me/name.' });
  }

  const user = await prisma.user.update({
    where: { id: req.auth!.sub },
    data: { paypalMeLink: handle },
    select: { id: true, paypalMeLink: true },
  });
  logger.info({ adminId: user.id, hatLink: handle !== null }, 'paypal.me-Link gepflegt.');
  return res.json({ user });
});
