import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAdmin, requireAdminOrLeitung, requireAuth } from '../auth/middleware.js';
import { computeMitgliederGuthabenSummeCent } from '../domain/guthaben.js';
import { logger } from '../logger.js';

export const kasseRouter = Router();

// Auth global; Autorisierung per Route (B2j): die beiden GET-Endpoints sind
// lesend für Admin ODER Leitung, die schreibenden POST-Aktionen bleiben
// Admin-only.
kasseRouter.use(requireAuth);

// GET /admin/kasse/summary — Kennzahlen der Vereinskasse, alle live (§6.8):
//   - toepfe: je Verwalter SUM(betragCent) WHERE konto=VERWALTER. Darf negativ.
//   - boxCent: SUM WHERE konto=BOX.
//   - vereinsvermoegenCent: SUM(alle KassenTransaktion) = Summe Töpfe + Box.
//   - mitgliederGuthabenSummeCent: SUM(alle Transaktion) — was die Kasse schuldet.
//   - deckungCent: Vereinsvermögen − Mitglieder-Summe. Positiv = Puffer.
// Die Töpfe-Liste = alle aktiven Admins ∪ alle verwalterId mit VERWALTER-
// Buchungen — so erscheint der eingeloggte Admin auch bei Topf 0 und historische
// Verwalter (B2k) bleiben sichtbar.
kasseRouter.get('/admin/kasse/summary', requireAdminOrLeitung, async (_req, res) => {
  const [verwalterGroups, boxAgg, vermoegenAgg, admins] = await Promise.all([
    prisma.kassenTransaktion.groupBy({
      by: ['verwalterId'],
      where: { konto: 'VERWALTER' },
      _sum: { betragCent: true },
    }),
    prisma.kassenTransaktion.aggregate({ _sum: { betragCent: true }, where: { konto: 'BOX' } }),
    prisma.kassenTransaktion.aggregate({ _sum: { betragCent: true } }),
    prisma.user.findMany({
      where: { isAdmin: true, isActive: true },
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);

  const topfMap = new Map<string, number>();
  for (const g of verwalterGroups) {
    if (g.verwalterId) topfMap.set(g.verwalterId, g._sum.betragCent ?? 0);
  }

  // IDs: aktive Admins ∪ verwalterId aus den Buchungen. Namen für unbekannte
  // (z.B. inaktiver Ex-Verwalter) nachladen.
  const ids = Array.from(new Set<string>([...admins.map((a) => a.id), ...topfMap.keys()]));
  const bekannt = new Map(admins.map((a) => [a.id, a]));
  const fehlend = ids.filter((id) => !bekannt.has(id));
  if (fehlend.length > 0) {
    const extra = await prisma.user.findMany({
      where: { id: { in: fehlend } },
      select: { id: true, firstName: true, lastName: true },
    });
    for (const u of extra) bekannt.set(u.id, u);
  }

  const toepfe = ids
    .map((id) => {
      const u = bekannt.get(id);
      return {
        verwalterId: id,
        firstName: u?.firstName ?? '?',
        lastName: u?.lastName ?? '',
        betragCent: topfMap.get(id) ?? 0,
      };
    })
    .sort((a, b) => a.firstName.localeCompare(b.firstName, 'de'));

  const boxCent = boxAgg._sum.betragCent ?? 0;
  const vereinsvermoegenCent = vermoegenAgg._sum.betragCent ?? 0;
  const mitgliederGuthabenSummeCent = await computeMitgliederGuthabenSummeCent();
  const deckungCent = vereinsvermoegenCent - mitgliederGuthabenSummeCent;

  return res.json({
    toepfe,
    boxCent,
    vereinsvermoegenCent,
    mitgliederGuthabenSummeCent,
    deckungCent,
  });
});

// GET /admin/kasse/historie — alle Kassen-Bewegungen chronologisch (jüngste
// zuerst), mit aufgelöstem Verwalter-Namen (null bei konto=BOX).
kasseRouter.get('/admin/kasse/historie', requireAdminOrLeitung, async (_req, res) => {
  const rows = await prisma.kassenTransaktion.findMany({
    orderBy: { createdAt: 'desc' },
    include: { verwalter: { select: { firstName: true, lastName: true } } },
  });

  const buchungen = rows.map((r) => ({
    id: r.id,
    typ: r.typ,
    konto: r.konto,
    verwalterId: r.verwalterId,
    verwalterName: r.verwalter ? `${r.verwalter.firstName} ${r.verwalter.lastName}` : null,
    betragCent: r.betragCent,
    notiz: r.notiz,
    transaktionId: r.transaktionId,
    einlageGegenId: r.einlageGegenId,
    createdAt: r.createdAt,
  }));

  return res.json({ buchungen });
});

// POST /admin/kasse/buchung — einzeilige Kassen-Aktion (§6.8). Ein generischer
// Endpoint für die vier einzeiligen Typen; EINLAGE_BOX (zweizeilig) hat seinen
// eigenen Endpoint unten.
//
// Betrags-Konvention (Frontend tippt immer einen Euro-Betrag ein):
//   - EINKAUF/ENTNAHME: client schickt positive Magnitude → Backend speichert
//     NEGATIV (Abfluss). Konto VERWALTER oder BOX; der Verwalter-Topf darf dabei
//     negativ werden (= Verein schuldet dem Verwalter).
//   - SPENDE: positive Magnitude → POSITIV (Zufluss).
//   - KORREKTUR: SIGNIERTER Betrag (±), ≠ 0, wird so gespeichert.
// Konto-Wahl VERWALTER/BOX frei. verwalterId = der eingeloggte Admin bei
// konto=VERWALTER, sonst null. vermerk Pflicht (§6.8).
const EINZEILIGE_TYPEN = ['EINKAUF', 'ENTNAHME', 'SPENDE', 'KORREKTUR'] as const;

const buchungSchema = z.object({
  typ: z.enum(EINZEILIGE_TYPEN),
  konto: z.enum(['VERWALTER', 'BOX']),
  betragCent: z.number().int(),
  vermerk: z.string(),
});

kasseRouter.post('/admin/kasse/buchung', requireAdmin, async (req, res) => {
  const parsed = buchungSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: 'Ungültige Eingaben.', details: parsed.error.flatten() });
  }
  const { typ, konto, betragCent } = parsed.data;
  const vermerk = parsed.data.vermerk.trim();
  if (!vermerk) return res.status(400).json({ error: 'Vermerk ist Pflicht.' });

  // Vorzeichen / Magnitude je Typ.
  let storedBetrag: number;
  if (typ === 'KORREKTUR') {
    if (betragCent === 0) {
      return res.status(400).json({ error: 'Korrektur-Betrag darf nicht 0 sein.' });
    }
    storedBetrag = betragCent;
  } else {
    if (betragCent <= 0) {
      return res.status(400).json({ error: 'Betrag muss positiv sein.' });
    }
    storedBetrag = typ === 'SPENDE' ? betragCent : -betragCent;
  }

  const adminId = req.auth!.sub;
  const verwalterId = konto === 'VERWALTER' ? adminId : null;

  const kassenTransaktion = await prisma.kassenTransaktion.create({
    data: { typ, konto, verwalterId, betragCent: storedBetrag, notiz: vermerk, erstelltVonId: adminId },
  });

  logger.info(
    { typ, konto, verwalterId, betragCent: storedBetrag, adminId, kassenTransaktionId: kassenTransaktion.id },
    'Kassen-Buchung gebucht.',
  );
  return res.status(201).json({ kassenTransaktion });
});

// POST /admin/kasse/einlage — EINLAGE_BOX: der Verwalter legt gehaltenes Geld in
// die Box. Zwei gekoppelte Zeilen in EINER $transaction (Muster wie die
// Aufladungs-Kopplung): VERWALTER −X (eigener Topf) + BOX +X, wechselseitig über
// einlageGegenId verknüpft. Vereinsvermögen bleibt gleich — nur Umschichtung.
const einlageSchema = z.object({
  betragCent: z.number().int().positive(),
  vermerk: z.string(),
});

kasseRouter.post('/admin/kasse/einlage', requireAdmin, async (req, res) => {
  const parsed = einlageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: 'Ungültige Eingaben.', details: parsed.error.flatten() });
  }
  const vermerk = parsed.data.vermerk.trim();
  if (!vermerk) return res.status(400).json({ error: 'Vermerk ist Pflicht.' });

  const adminId = req.auth!.sub;
  const betragCent = parsed.data.betragCent;

  const result = await prisma.$transaction(async (tx) => {
    const verwalterZeile = await tx.kassenTransaktion.create({
      data: {
        typ: 'EINLAGE_BOX',
        konto: 'VERWALTER',
        verwalterId: adminId,
        betragCent: -betragCent,
        notiz: vermerk,
        erstelltVonId: adminId,
      },
    });
    const boxZeile = await tx.kassenTransaktion.create({
      data: {
        typ: 'EINLAGE_BOX',
        konto: 'BOX',
        betragCent: betragCent,
        notiz: vermerk,
        erstelltVonId: adminId,
        einlageGegenId: verwalterZeile.id,
      },
    });
    const verwalterVerkn = await tx.kassenTransaktion.update({
      where: { id: verwalterZeile.id },
      data: { einlageGegenId: boxZeile.id },
    });
    return { verwalterZeile: verwalterVerkn, boxZeile };
  });

  logger.info(
    {
      adminId,
      betragCent,
      verwalterZeileId: result.verwalterZeile.id,
      boxZeileId: result.boxZeile.id,
    },
    'Einlage in die Box gebucht.',
  );
  return res.status(201).json(result);
});
