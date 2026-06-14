import { Router } from 'express';
import { z } from 'zod';
import type { User } from '@prisma/client';
import { prisma } from '../db.js';
import { requireAdmin, requireAuth } from '../auth/middleware.js';
import { computeGuthabenCent } from '../domain/guthaben.js';
import { logger } from '../logger.js';

export const aufladungRouter = Router();

// Nur Auth global; das Admin-Gate sitzt pro Route (requireAdmin), weil dieser
// Router sowohl Mitglieder-Endpoints (PayPal-Anfrage stellen, zuständigen
// Verwalter-Link lesen, eigene Anfragen) als auch Admin-Endpoints (Bargeld,
// PayPal bestätigen/ablehnen) bündelt.
aufladungRouter.use(requireAuth);

// Zuständiger Verwalter für die nächste PayPal-Aufladung.
//
// B2f-Scope: schlicht „der/ein Admin". Die echte Lastverteilung nach geringster
// gehaltener Summe inkl. offener Anfragen (KONFIGURATION §6.9) ist B2k und
// ersetzt genau diese Funktion. Auswahl hier deterministisch und degeneriert
// sauber zum Einzel-Verwalter-Fall:
//   1. nur aktive Admins,
//   2. bevorzugt einen mit hinterlegtem paypalMeLink (sonst kein Link zum
//      Überweisen),
//   3. unter denen alphabetisch nach Vorname (= späterer §6.9-Tie-Break).
// Liefert null, wenn es gar keinen aktiven Admin gibt.
async function ermittleZustaendigenVerwalter(): Promise<User | null> {
  const admins = await prisma.user.findMany({
    where: { isAdmin: true, isActive: true },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  });
  if (admins.length === 0) return null;
  return admins.find((a) => a.paypalMeLink) ?? admins[0];
}

// Verwalter-Sicht fürs Frontend — nur was zum Anzeigen/Verlinken nötig ist,
// kein passwordHash o.ä.
function verwalterPublic(v: User) {
  return {
    id: v.id,
    firstName: v.firstName,
    lastName: v.lastName,
    paypalMeLink: v.paypalMeLink,
  };
}

// GET /aufladung/zustaendiger-verwalter — wen sieht das Mitglied im Aufladen-
// Tab? Liefert den zuständigen Verwalter (Name + paypalMeLink) oder null.
// Reines Anzeigen verbraucht KEINE Zuteilung (die passiert erst beim Abschicken,
// §6.9) — in B2f ohnehin zustandslos, aber so bleibt das Verhalten B2k-konform.
aufladungRouter.get('/aufladung/zustaendiger-verwalter', async (_req, res) => {
  const verwalter = await ermittleZustaendigenVerwalter();
  return res.json({ verwalter: verwalter ? verwalterPublic(verwalter) : null });
});

// POST /aufladung/paypal — Mitglied stellt eine PayPal-Aufladungs-Anfrage.
// Legt eine AufladungsAnfrage mit status=OFFEN an und weist sie dem aktuell
// zuständigen Verwalter zu (§6.5 Schritt 4). KEINE Buchung — die entsteht erst
// bei der Admin-Bestätigung (B2f.3). Gibt den Verwalter mit zurück, damit das
// Frontend den paypal.me-Link öffnen kann.
const paypalAnfrageSchema = z.object({
  betragCent: z.number().int().positive(),
});

aufladungRouter.post('/aufladung/paypal', async (req, res) => {
  const parsed = paypalAnfrageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: 'Ungültige Eingaben.', details: parsed.error.flatten() });
  }

  const verwalter = await ermittleZustaendigenVerwalter();
  if (!verwalter) {
    return res
      .status(409)
      .json({ error: 'Aktuell ist kein Verwalter für PayPal-Aufladungen verfügbar.' });
  }

  const userId = req.auth!.sub;
  const betragCent = parsed.data.betragCent;

  const anfrage = await prisma.aufladungsAnfrage.create({
    data: {
      userId,
      betragCent,
      status: 'OFFEN',
      zugewiesenerVerwalterId: verwalter.id,
    },
  });

  logger.info(
    { userId, anfrageId: anfrage.id, betragCent, zugewiesenerVerwalterId: verwalter.id },
    'PayPal-Aufladungs-Anfrage gestellt.',
  );

  return res.status(201).json({ anfrage, verwalter: verwalterPublic(verwalter) });
});

// GET /aufladung/meine — eigene Aufladungs-Anfragen des Mitglieds, neueste
// zuerst. Frontend hebt die offenen hervor (Status-Anzeige, §7.1). Enthält den
// zugewiesenen Verwalter-Namen, damit das Mitglied weiß, an wen es überwiesen
// hat / überweisen soll.
aufladungRouter.get('/aufladung/meine', async (req, res) => {
  const userId = req.auth!.sub;
  const anfragen = await prisma.aufladungsAnfrage.findMany({
    where: { userId },
    orderBy: { requestedAt: 'desc' },
    include: {
      zugewiesenerVerwalter: { select: { id: true, firstName: true, lastName: true, paypalMeLink: true } },
    },
  });
  return res.json({ anfragen });
});

// POST /admin/aufladung/bargeld — Verwalter trägt eine Bargeld-Einzahlung
// eines Mitglieds ein. Erzeugt zwei wechselseitig verknüpfte Buchungen
// atomar (KONFIGURATION.md §6.4):
//   - Mitglieder-Transaktion: typ=AUFLADUNG_BARGELD, +X, Vermerk
//   - Kassen-Buchung:         typ=EINZAHLUNG, konto=VERWALTER,
//                             verwalterId=eingeloggter Admin, +X, Vermerk
// Vermerk ist Pflicht (§6.8). verwalterId = eingeloggter Admin — die
// Multi-Verwalter-Verteilung kommt in B2k und degeneriert hier sauber zum
// Einzelfall.
const bargeldSchema = z.object({
  userId: z.string().min(1),
  betragCent: z.number().int().positive(),
  vermerk: z.string(),
});

aufladungRouter.post('/admin/aufladung/bargeld', requireAdmin, async (req, res) => {
  const parsed = bargeldSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: 'Ungültige Eingaben.', details: parsed.error.flatten() });
  }
  const vermerk = parsed.data.vermerk.trim();
  if (!vermerk) {
    return res.status(400).json({ error: 'Vermerk ist Pflicht.' });
  }

  const empfaenger = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!empfaenger) return res.status(404).json({ error: 'Mitglied nicht gefunden.' });
  if (!empfaenger.isActive) {
    return res.status(400).json({ error: 'Mitglied ist deaktiviert — keine Aufladung möglich.' });
  }

  const adminId = req.auth!.sub;
  const betragCent = parsed.data.betragCent;

  // Wechselseitige Verlinkung: erst die Kassen-Zeile ohne FK, dann die
  // Mitglieder-Zeile mit FK auf die Kasse, dann die Kassen-Zeile um die
  // Mitglieder-FK aktualisieren. Alles in einer atomaren $transaction.
  const result = await prisma.$transaction(async (tx) => {
    const kasse = await tx.kassenTransaktion.create({
      data: {
        typ: 'EINZAHLUNG',
        konto: 'VERWALTER',
        verwalterId: adminId,
        betragCent,
        notiz: vermerk,
        erstelltVonId: adminId,
      },
    });
    const mitglied = await tx.transaktion.create({
      data: {
        typ: 'AUFLADUNG_BARGELD',
        userId: empfaenger.id,
        erstelltVonId: adminId,
        betragCent,
        notiz: vermerk,
        kassenTransaktionId: kasse.id,
      },
    });
    const kasseVerkn = await tx.kassenTransaktion.update({
      where: { id: kasse.id },
      data: { transaktionId: mitglied.id },
    });
    return { mitglied, kasse: kasseVerkn };
  });

  const guthabenCent = await computeGuthabenCent(empfaenger.id);
  logger.info(
    {
      empfaengerId: empfaenger.id,
      adminId,
      betragCent,
      transaktionId: result.mitglied.id,
      kassenTransaktionId: result.kasse.id,
    },
    'Bargeld-Aufladung gebucht.',
  );

  return res.status(201).json({
    transaktion: result.mitglied,
    kassenTransaktion: result.kasse,
    guthabenCent,
  });
});

// GET /admin/aufladung/anfragen — offene PayPal-Anfragen für die Admin-Liste.
// B2f: alle offenen (kein Filter auf den zugewiesenen Verwalter). Die
// gefilterte Sicht „nur meine zugewiesenen" kommt in B2k (§7.2). Älteste zuerst,
// damit die Liste eine natürliche Abarbeitungs-Reihenfolge hat. Mitglied-Daten
// (Name/Email) zum Anzeigen mitgeliefert.
aufladungRouter.get('/admin/aufladung/anfragen', requireAdmin, async (_req, res) => {
  const anfragen = await prisma.aufladungsAnfrage.findMany({
    where: { status: 'OFFEN' },
    orderBy: { requestedAt: 'asc' },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });
  return res.json({ anfragen });
});

// POST /admin/aufladung/anfragen/:id/bestaetigen — Verwalter bestätigt eine
// PayPal-Anfrage. Erzeugt — exakt wie die Bargeld-Aufladung (§6.4/§6.5) — zwei
// wechselseitig verknüpfte Buchungen atomar, nur mit typ=AUFLADUNG_PAYPAL:
//   - Mitglieder-Transaktion: AUFLADUNG_PAYPAL, +X
//   - Kassen-Buchung:         EINZAHLUNG, konto=VERWALTER,
//                             verwalterId=zugewiesener Verwalter, +X
// und setzt die Anfrage auf BESTAETIGT (decidedAt/decidedById/transaktionId).
// verwalterId ist der ZUGEWIESENE Verwalter (an dessen paypal.me das Mitglied
// gezahlt hat), nicht zwingend der bestätigende — in B2f identisch (ein Admin).
// Das Beschränken aufs „nur der Zugewiesene darf bestätigen" ist B2k.
// notiz ist auf der Kassen-Zeile Pflicht (§6.8) → Auto-Vermerk; eine optionale
// adminNotiz wird zusätzlich an der Anfrage gespeichert.
const bestaetigenSchema = z.object({
  adminNotiz: z.string().optional(),
});

aufladungRouter.post(
  '/admin/aufladung/anfragen/:id/bestaetigen',
  requireAdmin,
  async (req, res) => {
    const parsed = bestaetigenSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Ungültige Eingaben.', details: parsed.error.flatten() });
    }
    const adminNotiz = parsed.data.adminNotiz?.trim() || null;

    const anfrage = await prisma.aufladungsAnfrage.findUnique({ where: { id: req.params.id } });
    if (!anfrage) return res.status(404).json({ error: 'Anfrage nicht gefunden.' });
    if (anfrage.status !== 'OFFEN') {
      return res.status(400).json({ error: 'Diese Anfrage wurde bereits entschieden.' });
    }

    const empfaenger = await prisma.user.findUnique({ where: { id: anfrage.userId } });
    if (!empfaenger || !empfaenger.isActive) {
      return res.status(400).json({ error: 'Mitglied ist nicht (mehr) aktiv.' });
    }

    const adminId = req.auth!.sub;
    const betragCent = anfrage.betragCent;
    const verwalterId = anfrage.zugewiesenerVerwalterId;
    const vermerk = adminNotiz
      ? `PayPal-Aufladung bestätigt — ${adminNotiz}`
      : 'PayPal-Aufladung bestätigt.';

    const result = await prisma.$transaction(async (tx) => {
      const kasse = await tx.kassenTransaktion.create({
        data: {
          typ: 'EINZAHLUNG',
          konto: 'VERWALTER',
          verwalterId,
          betragCent,
          notiz: vermerk,
          erstelltVonId: adminId,
        },
      });
      const mitglied = await tx.transaktion.create({
        data: {
          typ: 'AUFLADUNG_PAYPAL',
          userId: empfaenger.id,
          erstelltVonId: adminId,
          betragCent,
          notiz: vermerk,
          kassenTransaktionId: kasse.id,
        },
      });
      const kasseVerkn = await tx.kassenTransaktion.update({
        where: { id: kasse.id },
        data: { transaktionId: mitglied.id },
      });
      const anfrageVerkn = await tx.aufladungsAnfrage.update({
        where: { id: anfrage.id },
        data: {
          status: 'BESTAETIGT',
          decidedAt: new Date(),
          decidedById: adminId,
          adminNotiz,
          transaktionId: mitglied.id,
        },
      });
      return { mitglied, kasse: kasseVerkn, anfrage: anfrageVerkn };
    });

    const guthabenCent = await computeGuthabenCent(empfaenger.id);
    logger.info(
      {
        anfrageId: anfrage.id,
        empfaengerId: empfaenger.id,
        adminId,
        verwalterId,
        betragCent,
        transaktionId: result.mitglied.id,
        kassenTransaktionId: result.kasse.id,
      },
      'PayPal-Aufladung bestätigt.',
    );

    return res.status(201).json({
      anfrage: result.anfrage,
      transaktion: result.mitglied,
      kassenTransaktion: result.kasse,
      guthabenCent,
    });
  },
);

// POST /admin/aufladung/anfragen/:id/ablehnen — Verwalter lehnt eine PayPal-
// Anfrage ab. KEINE Buchung (§6.5 Schritt 8). Optionale adminNotiz.
const ablehnenSchema = z.object({
  adminNotiz: z.string().optional(),
});

aufladungRouter.post(
  '/admin/aufladung/anfragen/:id/ablehnen',
  requireAdmin,
  async (req, res) => {
    const parsed = ablehnenSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Ungültige Eingaben.', details: parsed.error.flatten() });
    }
    const adminNotiz = parsed.data.adminNotiz?.trim() || null;

    const anfrage = await prisma.aufladungsAnfrage.findUnique({ where: { id: req.params.id } });
    if (!anfrage) return res.status(404).json({ error: 'Anfrage nicht gefunden.' });
    if (anfrage.status !== 'OFFEN') {
      return res.status(400).json({ error: 'Diese Anfrage wurde bereits entschieden.' });
    }

    const adminId = req.auth!.sub;
    const aktualisiert = await prisma.aufladungsAnfrage.update({
      where: { id: anfrage.id },
      data: {
        status: 'ABGELEHNT',
        decidedAt: new Date(),
        decidedById: adminId,
        adminNotiz,
      },
    });

    logger.info(
      { anfrageId: anfrage.id, adminId, betragCent: anfrage.betragCent },
      'PayPal-Aufladung abgelehnt.',
    );
    return res.json({ anfrage: aktualisiert });
  },
);
