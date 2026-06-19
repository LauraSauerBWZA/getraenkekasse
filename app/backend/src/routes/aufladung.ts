import { Router } from 'express';
import { z } from 'zod';
import type { User } from '@prisma/client';
import { prisma } from '../db.js';
import { requireAdmin, requireAuth } from '../auth/middleware.js';
import { computeGuthabenCent } from '../domain/guthaben.js';
import { ermittleZustaendigenVerwalter } from '../domain/lastverteilung.js';
import { logger } from '../logger.js';

export const aufladungRouter = Router();

// Nur Auth global; das Admin-Gate sitzt pro Route (requireAdmin), weil dieser
// Router sowohl Mitglieder-Endpoints (PayPal-Anfrage stellen, zuständigen
// Verwalter-Link lesen, eigene Anfragen) als auch Admin-Endpoints (Bargeld,
// PayPal bestätigen/ablehnen) bündelt.
aufladungRouter.use(requireAuth);

// Lastverteilung „geringste Schuld zuerst" (§6.9) lebt jetzt in
// domain/lastverteilung.ts (Cleanup) — von hier (neue PayPal-Anfrage) UND von der
// Neuzuweisung beim Verwalter-Wegfall (Demote/Remove) genutzt.

// Verwalter-Sicht fürs Frontend — nur was zum Anzeigen/Verlinken nötig ist,
// kein passwordHash o.ä. whatsappNummer kommt mit, damit das Mitglied den
// zuständigen Verwalter nach der Überweisung per wa.me benachrichtigen kann.
function verwalterPublic(v: User) {
  return {
    id: v.id,
    firstName: v.firstName,
    lastName: v.lastName,
    paypalMeLink: v.paypalMeLink,
    whatsappNummer: v.whatsappNummer,
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

// POST /aufladung/paypal — Mitglied stellt eine BETRAGLOSE PayPal-Aufladungs-
// Anfrage (PayPal-Umbau). Das Mitglied überweist selbst einen frei gewählten
// Betrag an den paypal.me-Link des zuständigen Verwalters; die echte Summe gibt
// der Verwalter erst beim Bestätigen ein. Legt eine AufladungsAnfrage mit
// status=OFFEN und betragCent=null an, zugewiesen an den aktuell zuständigen
// Verwalter (§6.5/§6.9). KEINE Buchung. Gibt den Verwalter zurück, damit das
// Frontend paypal.me öffnen + die WhatsApp-Benachrichtigung bauen kann.
// Kein Request-Body nötig (betraglos).
aufladungRouter.post('/aufladung/paypal', async (req, res) => {
  const verwalter = await ermittleZustaendigenVerwalter();
  if (!verwalter) {
    return res.status(400).json({
      error: 'Kein Verwalter mit PayPal-Link hinterlegt — bitte Bargeld nutzen oder später erneut versuchen.',
    });
  }

  const userId = req.auth!.sub;

  const anfrage = await prisma.aufladungsAnfrage.create({
    data: {
      userId,
      betragCent: null,
      status: 'OFFEN',
      zugewiesenerVerwalterId: verwalter.id,
    },
  });

  logger.info(
    { userId, anfrageId: anfrage.id, zugewiesenerVerwalterId: verwalter.id },
    'Betraglose PayPal-Aufladungs-Anfrage gestellt.',
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

// Gemeinsame Schreibseite jeder admin-eingetragenen Aufladung (Bargeld ODER
// PayPal-direkt ODER PayPal-Anfrage-Bestätigung könnten das nutzen): zwei
// wechselseitig verknüpfte Buchungen atomar (KONFIGURATION.md §6.4) — erst die
// Kassen-EINZAHLUNG ohne FK, dann die Mitglieder-AUFLADUNG mit FK auf die Kasse,
// dann die Kassen-Zeile um die Mitglieder-FK ergänzen. EINE $transaction.
async function bucheGekoppelteEinzahlung(opts: {
  empfaengerId: string;
  betragCent: number;
  vermerk: string;
  typ: 'AUFLADUNG_BARGELD' | 'AUFLADUNG_PAYPAL';
  konto: 'VERWALTER' | 'BOX';
  verwalterId: string | null;
  adminId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const kasse = await tx.kassenTransaktion.create({
      data: {
        typ: 'EINZAHLUNG',
        konto: opts.konto,
        verwalterId: opts.verwalterId,
        betragCent: opts.betragCent,
        notiz: opts.vermerk,
        erstelltVonId: opts.adminId,
      },
    });
    const mitglied = await tx.transaktion.create({
      data: {
        typ: opts.typ,
        userId: opts.empfaengerId,
        erstelltVonId: opts.adminId,
        betragCent: opts.betragCent,
        notiz: opts.vermerk,
        kassenTransaktionId: kasse.id,
      },
    });
    const kasseVerkn = await tx.kassenTransaktion.update({
      where: { id: kasse.id },
      data: { transaktionId: mitglied.id },
    });
    return { mitglied, kasse: kasseVerkn };
  });
}

// POST /admin/aufladung/bargeld — Verwalter trägt eine Bargeld-Einzahlung
// eines Mitglieds ein. Erzeugt zwei wechselseitig verknüpfte Buchungen
// atomar (KONFIGURATION.md §6.4):
//   - Mitglieder-Transaktion: typ=AUFLADUNG_BARGELD, +X, Vermerk (unverändert)
//   - Kassen-Buchung:         typ=EINZAHLUNG, +X, Vermerk — Konto je nach Wahl:
//       * konto=VERWALTER, verwalterId=eingeloggter Admin (Verwalter-Topf, Default)
//       * konto=BOX,       verwalterId=null (Bar-Vereinskasse/Box)
// Vermerk ist Pflicht (§6.8). Die Konto-Wahl (Bündel 2, Einheit 2) nutzt das
// bestehende Schema-Feld `konto` — kein Schema-Change. Default VERWALTER hält das
// bisherige Verhalten (kompatibel mit Clients, die kein `konto` schicken).
const bargeldSchema = z.object({
  userId: z.string().min(1),
  betragCent: z.number().int().positive(),
  vermerk: z.string(),
  konto: z.enum(['VERWALTER', 'BOX']).default('VERWALTER'),
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
  const konto = parsed.data.konto;
  // BOX hat keinen Verwalter-Bezug (verwalterId=null); VERWALTER bucht auf den
  // Topf des eingeloggten Admins.
  const verwalterId = konto === 'VERWALTER' ? adminId : null;

  const result = await bucheGekoppelteEinzahlung({
    empfaengerId: empfaenger.id,
    betragCent,
    vermerk,
    typ: 'AUFLADUNG_BARGELD',
    konto,
    verwalterId,
    adminId,
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

// POST /admin/aufladung/einzahlung — admin-DIREKTE Einzahlung (Bündel 3,
// Einheit 2). Ein geführter Admin-Flow trägt eine Einzahlung direkt ein, per
// Methode BAR oder PAYPAL — OHNE member-initiierte AufladungsAnfrage. Betrag
// Pflicht (Int > 0), Vermerk Pflicht. Bucht gekoppelt (EINE $transaction) über
// bucheGekoppelteEinzahlung:
//   - BAR:    typ=AUFLADUNG_BARGELD; Kassen-Konto frei (Verwalter-Topf ODER Box),
//             verwalterId = eingeloggter Admin bei VERWALTER, null bei BOX.
//   - PAYPAL: typ=AUFLADUNG_PAYPAL; Konto IMMER VERWALTER, verwalterId = der
//             eintragende Admin (das Geld liegt auf dessen PayPal) — KEIN Box-Konto.
// Die member-initiierte PayPal-Anfrage (zugewiesener Verwalter bestätigt mit echter
// Summe) bleibt davon unberührt — das hier ist der zusätzliche admin-direkte Weg.
const einzahlungSchema = z.object({
  userId: z.string().min(1),
  betragCent: z.number().int().positive(),
  vermerk: z.string(),
  methode: z.enum(['BAR', 'PAYPAL']),
  // Nur für BAR relevant; bei PAYPAL ignoriert (immer VERWALTER). Default VERWALTER.
  konto: z.enum(['VERWALTER', 'BOX']).default('VERWALTER'),
});

aufladungRouter.post('/admin/aufladung/einzahlung', requireAdmin, async (req, res) => {
  const parsed = einzahlungSchema.safeParse(req.body);
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
    return res.status(400).json({ error: 'Mitglied ist deaktiviert — keine Einzahlung möglich.' });
  }

  const adminId = req.auth!.sub;
  const betragCent = parsed.data.betragCent;
  const methode = parsed.data.methode;

  // PayPal-direkt liegt IMMER auf dem PayPal-Topf des eintragenden Admins
  // (konto=VERWALTER, verwalterId=Admin) — Box-Wahl gibt es nur bei Bargeld.
  const typ = methode === 'PAYPAL' ? 'AUFLADUNG_PAYPAL' : 'AUFLADUNG_BARGELD';
  const konto = methode === 'PAYPAL' ? 'VERWALTER' : parsed.data.konto;
  const verwalterId = konto === 'VERWALTER' ? adminId : null;

  const result = await bucheGekoppelteEinzahlung({
    empfaengerId: empfaenger.id,
    betragCent,
    vermerk,
    typ,
    konto,
    verwalterId,
    adminId,
  });

  const guthabenCent = await computeGuthabenCent(empfaenger.id);
  logger.info(
    {
      empfaengerId: empfaenger.id,
      adminId,
      methode,
      konto,
      betragCent,
      transaktionId: result.mitglied.id,
      kassenTransaktionId: result.kasse.id,
    },
    'Admin-direkte Einzahlung gebucht.',
  );

  return res.status(201).json({
    transaktion: result.mitglied,
    kassenTransaktion: result.kasse,
    guthabenCent,
  });
});

// GET /admin/aufladung/anfragen — offene PayPal-Anfragen, gefiltert auf die dem
// eingeloggten Verwalter ZUGEWIESENEN (§7.2/§6.9, B2k). Jeder Verwalter sieht
// und bestätigt nur seine eigenen. Älteste zuerst (natürliche Abarbeitungs-
// Reihenfolge); Mitglied-Daten (Name/Email) zum Anzeigen mitgeliefert.
aufladungRouter.get('/admin/aufladung/anfragen', requireAdmin, async (req, res) => {
  const anfragen = await prisma.aufladungsAnfrage.findMany({
    where: { status: 'OFFEN', zugewiesenerVerwalterId: req.auth!.sub },
    orderBy: { requestedAt: 'asc' },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });
  return res.json({ anfragen });
});

// POST /admin/aufladung/anfragen/:id/bestaetigen — Verwalter bestätigt eine
// PayPal-Anfrage und gibt dabei die TATSÄCHLICH überwiesene Summe ein
// (betragCent, Int > 0 — PayPal-Umbau, §6.5). Die Anfrage selbst ist betraglos;
// gebucht wird genau dieser eingegebene Betrag. Erzeugt — exakt wie die Bargeld-
// Aufladung (§6.4) — zwei wechselseitig verknüpfte Buchungen atomar, mit
// typ=AUFLADUNG_PAYPAL:
//   - Mitglieder-Transaktion: AUFLADUNG_PAYPAL, +X
//   - Kassen-Buchung:         EINZAHLUNG, konto=VERWALTER,
//                             verwalterId=zugewiesener Verwalter, +X
// und setzt die Anfrage auf BESTAETIGT (decidedAt/decidedById/transaktionId,
// betragCent=X zur Doku). verwalterId ist der ZUGEWIESENE Verwalter (an dessen
// paypal.me das Mitglied gezahlt hat) — und nur er selbst darf bestätigen (Guard).
// notiz ist auf der Kassen-Zeile Pflicht (§6.8) → Auto-Vermerk; eine optionale
// adminNotiz wird zusätzlich an der Anfrage gespeichert.
const bestaetigenSchema = z.object({
  betragCent: z.number().int().positive(),
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
        .json({ error: 'Bitte die tatsächlich überwiesene Summe angeben (Betrag > 0).', details: parsed.error.flatten() });
    }
    const adminNotiz = parsed.data.adminNotiz?.trim() || null;

    const anfrage = await prisma.aufladungsAnfrage.findUnique({ where: { id: req.params.id } });
    if (!anfrage) return res.status(404).json({ error: 'Anfrage nicht gefunden.' });
    if (anfrage.status !== 'OFFEN') {
      return res.status(400).json({ error: 'Diese Anfrage wurde bereits entschieden.' });
    }
    // Nur der zugewiesene Verwalter darf bestätigen (§6.5/§6.9).
    if (anfrage.zugewiesenerVerwalterId !== req.auth!.sub) {
      return res
        .status(403)
        .json({ error: 'Nur der zugewiesene Verwalter darf diese Anfrage bestätigen.' });
    }

    const empfaenger = await prisma.user.findUnique({ where: { id: anfrage.userId } });
    if (!empfaenger || !empfaenger.isActive) {
      return res.status(400).json({ error: 'Mitglied ist nicht (mehr) aktiv.' });
    }

    const adminId = req.auth!.sub;
    const betragCent = parsed.data.betragCent;
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
          betragCent, // tatsächlich überwiesene Summe zur Doku festhalten
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
    // Nur der zugewiesene Verwalter darf ablehnen (§6.5/§6.9, B2k).
    if (anfrage.zugewiesenerVerwalterId !== req.auth!.sub) {
      return res
        .status(403)
        .json({ error: 'Nur der zugewiesene Verwalter darf diese Anfrage ablehnen.' });
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
