import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAdmin, requireAdminOrLeitung, requireAuth } from '../auth/middleware.js';
import { computeGuthabenCent, computeMitgliederGuthabenSummeCent } from '../domain/guthaben.js';
import { kassenStornoData, transaktionStornoData } from '../domain/storno.js';
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

  // Welche Buchungen sind bereits storniert? Eine Zeile gilt als storniert, sobald
  // eine andere Zeile via stornoVonId auf sie zeigt. Set der referenzierten IDs.
  const stornierteIds = new Set(
    rows.filter((r) => r.stornoVonId !== null).map((r) => r.stornoVonId as string),
  );

  const buchungen = rows.map((r) => {
    const istStorno = r.stornoVonId !== null;
    const storniert = stornierteIds.has(r.id);
    // Nicht stornierbar: Storno-Buchungen selbst, bereits stornierte und die
    // zweizeilige EINLAGE_BOX-Umschichtung (einlageGegenId) — deren Halb-Storno
    // wäre unausgeglichen (bewusst aus dem Scope, eigene Phase).
    const stornierbar = !istStorno && !storniert && r.einlageGegenId === null;
    return {
      id: r.id,
      typ: r.typ,
      konto: r.konto,
      verwalterId: r.verwalterId,
      verwalterName: r.verwalter ? `${r.verwalter.firstName} ${r.verwalter.lastName}` : null,
      betragCent: r.betragCent,
      notiz: r.notiz,
      transaktionId: r.transaktionId,
      einlageGegenId: r.einlageGegenId,
      stornoVonId: r.stornoVonId,
      storniert,
      stornierbar,
      createdAt: r.createdAt,
    };
  });

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

// POST /admin/kasse/buchung/:id/storno — eine Kassen-Buchung stornieren (Bündel 3,
// Einheit 3). Storno = Gegenbuchung (KORREKTUR, umgekehrtes Vorzeichen,
// stornoVonId=Original, gleiches Konto/verwalterId), KEIN Hard-Delete. Pflicht-Notiz.
//
// Ist die Buchung eine an eine Mitglieder-Aufladung GEKOPPELTE EINZAHLUNG
// (transaktionId gesetzt), wird in DERSELBEN $transaction auch die Mitglieder-Seite
// zurückgerollt — identisch zum bestehenden Mitglieder-Storno-Weg (buchen.ts), über
// die gemeinsamen Builder in domain/storno.ts. Keine Doppel-Buchung.
//
// Nicht stornierbar: Storno-Buchungen selbst (stornoVonId gesetzt), bereits
// stornierte (eine Zeile zeigt via stornoVonId auf sie) und die EINLAGE_BOX-
// Umschichtung (einlageGegenId) — analog zur stornierbar-Logik der Historie.
const kassenStornoSchema = z.object({
  notiz: z.string(),
});

kasseRouter.post('/admin/kasse/buchung/:id/storno', requireAdmin, async (req, res) => {
  const parsed = kassenStornoSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Ungültige Eingaben.', details: parsed.error.flatten() });
  }
  const notiz = parsed.data.notiz.trim();
  if (!notiz) return res.status(400).json({ error: 'Notiz ist beim Storno Pflicht.' });

  const original = await prisma.kassenTransaktion.findUnique({ where: { id: req.params.id } });
  if (!original) return res.status(404).json({ error: 'Kassen-Buchung nicht gefunden.' });

  // Keine Storno-Stornos.
  if (original.stornoVonId !== null) {
    return res.status(400).json({ error: 'Eine Storno-Buchung kann nicht storniert werden.' });
  }
  // Kein Doppel-Storno — zeigt schon eine Zeile via stornoVonId auf diese Buchung?
  const bereits = await prisma.kassenTransaktion.findFirst({
    where: { stornoVonId: original.id },
    select: { id: true },
  });
  if (bereits) {
    return res.status(400).json({ error: 'Diese Buchung wurde bereits storniert.' });
  }
  // EINLAGE_BOX-Umschichtung ist zweizeilig gekoppelt — Halb-Storno wäre
  // unausgeglichen (bewusst aus dem Scope).
  if (original.einlageGegenId !== null) {
    return res
      .status(400)
      .json({ error: 'Box-Einlagen können hier (noch) nicht einzeln storniert werden.' });
  }

  const adminId = req.auth!.sub;

  // Bei gekoppelter EINZAHLUNG die Mitglieder-Aufladung mitziehen — aber nur, wenn
  // sie nicht schon (vom Mitglieder-Weg) storniert wurde. Defensive Sicherung.
  const gekoppelt = original.transaktionId !== null;

  const result = await prisma.$transaction(async (tx) => {
    const gegen = await tx.kassenTransaktion.create({
      data: kassenStornoData(original, { erstelltVonId: adminId, notiz }),
    });

    let mitgliedStorno: Awaited<ReturnType<typeof tx.transaktion.create>> | null = null;
    let betroffenerUserId: string | null = null;
    if (gekoppelt) {
      const aufladung = await tx.transaktion.findUnique({
        where: { id: original.transaktionId! },
      });
      if (aufladung) {
        const schonStorniert = await tx.transaktion.findFirst({
          where: { typ: 'STORNO', stornoVonId: aufladung.id },
          select: { id: true },
        });
        if (!schonStorniert) {
          mitgliedStorno = await tx.transaktion.create({
            data: transaktionStornoData(aufladung, { erstelltVonId: adminId, notiz }),
          });
          betroffenerUserId = aufladung.userId;
        }
      }
    }

    return { gegen, mitgliedStorno, betroffenerUserId };
  });

  const guthabenCent = result.betroffenerUserId
    ? await computeGuthabenCent(result.betroffenerUserId)
    : null;

  logger.info(
    {
      adminId,
      originalId: original.id,
      gegenId: result.gegen.id,
      gekoppelt,
      mitgliedStornoId: result.mitgliedStorno?.id ?? null,
      betragCent: result.gegen.betragCent,
    },
    'Kassen-Buchung storniert.',
  );

  return res.status(201).json({
    storno: result.gegen,
    mitgliedStorno: result.mitgliedStorno,
    guthabenCent,
  });
});
