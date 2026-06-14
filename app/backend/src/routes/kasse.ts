import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAdmin, requireAuth } from '../auth/middleware.js';
import { computeMitgliederGuthabenSummeCent } from '../domain/guthaben.js';

export const kasseRouter = Router();

// Komplett admin-gated (Leitung-Read-only-Sicht ist B2j, nicht hier).
kasseRouter.use(requireAuth, requireAdmin);

// GET /admin/kasse/summary — Kennzahlen der Vereinskasse, alle live (§6.8):
//   - toepfe: je Verwalter SUM(betragCent) WHERE konto=VERWALTER. Darf negativ.
//   - boxCent: SUM WHERE konto=BOX.
//   - vereinsvermoegenCent: SUM(alle KassenTransaktion) = Summe Töpfe + Box.
//   - mitgliederGuthabenSummeCent: SUM(alle Transaktion) — was die Kasse schuldet.
//   - deckungCent: Vereinsvermögen − Mitglieder-Summe. Positiv = Puffer.
// Die Töpfe-Liste = alle aktiven Admins ∪ alle verwalterId mit VERWALTER-
// Buchungen — so erscheint der eingeloggte Admin auch bei Topf 0 und historische
// Verwalter (B2k) bleiben sichtbar.
kasseRouter.get('/admin/kasse/summary', async (_req, res) => {
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
kasseRouter.get('/admin/kasse/historie', async (_req, res) => {
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
