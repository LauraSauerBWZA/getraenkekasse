import { Router } from 'express';
import { z } from 'zod';
import type { User } from '@prisma/client';
import { prisma } from '../db.js';
import { requireAdmin, requireAuth } from '../auth/middleware.js';
import { computeGuthabenCent } from '../domain/guthaben.js';
import { ermittleZustaendigenVerwalter } from '../domain/lastverteilung.js';
import { logger } from '../logger.js';

export const aufladungRouter = Router();

// Nur Auth global; das Admin-Gate sitzt pro Route (requireAdmin). Dieser Router
// bündelt den lesenden Mitglieder-Endpoint (zuständigen Verwalter-Link anzeigen)
// und die Admin-Endpoints (Bargeld- + admin-direkte Einzahlung).
//
// Bündel 5: Die member-initiierte AufladungsAnfrage entfällt komplett — Mitglieder
// überweisen direkt per paypal.me und geben dem Verwalter per WhatsApp Bescheid; der
// Verwalter bucht admin-direkt (POST /admin/aufladung/einzahlung). Die früheren
// Anfrage-Endpoints (POST /aufladung/paypal, GET /aufladung/meine, GET+POST unter
// /admin/aufladung/anfragen) sind ersatzlos entfernt. Die AufladungsAnfrage-Tabelle
// bleibt im Schema (Export/Lösch-Guard/Altbestand) — nur ohne Schreibweg von hier.
aufladungRouter.use(requireAuth);

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
