import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth } from '../auth/middleware.js';
import { computeGuthabenCent } from '../domain/guthaben.js';
import { logger } from '../logger.js';

// Fix kodiert (KONFIGURATION.md §6.3 / PROMPTS/02d-storno.md §3).
// Mitglied kann eine eigene KAUF-Transaktion innerhalb dieser Spanne nach
// `createdAt` selbst stornieren. Admin ist nicht an das Fenster gebunden.
const STORNO_FENSTER_MINUTEN = 5;
const STORNO_AUTO_NOTIZ_MITGLIED = 'Storno durch Mitglied (5-Min-Fenster).';

export const buchenRouter = Router();

buchenRouter.use(requireAuth);

// GET /drinks — Liste der für Mitglieder buchbaren Drinks.
// Nur isActive=true (Soft-Disable blendet im Buchen-Tab aus, behält aber
// die Drink-Referenz für historische Transaktionen). Flach + sortiert nach
// Kategorie+Name — Gruppierung übernimmt das Frontend.
buchenRouter.get('/drinks', async (_req, res) => {
  const drinks = await prisma.drink.findMany({
    where: { isActive: true },
    orderBy: [{ kategorie: 'asc' }, { name: 'asc' }],
  });
  return res.json({ drinks });
});

const kaufSchema = z.object({
  drinkId: z.string().min(1),
});

// POST /transaktionen/kauf — Selbstbuchung eines Drinks durch das Mitglied.
// preisAtKaufCent friert den aktuellen Preis ein (§5.3, §6.2). Negatives
// Guthaben blockt NICHT (§6.6) — Confirm-Sheet warnt im Frontend.
buchenRouter.post('/transaktionen/kauf', async (req, res) => {
  const parsed = kaufSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Ungültige Eingaben.', details: parsed.error.flatten() });
  }

  const drink = await prisma.drink.findUnique({ where: { id: parsed.data.drinkId } });
  if (!drink) return res.status(404).json({ error: 'Drink nicht gefunden.' });
  if (!drink.isActive) return res.status(400).json({ error: 'Drink ist nicht mehr buchbar.' });

  const userId = req.auth!.sub;
  const transaktion = await prisma.transaktion.create({
    data: {
      typ: 'KAUF',
      userId,
      erstelltVonId: userId, // Selbstbuchung
      drinkId: drink.id,
      preisAtKaufCent: drink.preisCent,
      betragCent: -drink.preisCent,
    },
  });

  const guthabenCent = await computeGuthabenCent(userId);
  logger.info(
    { userId, transaktionId: transaktion.id, drinkId: drink.id, betragCent: transaktion.betragCent },
    'Kauf gebucht.',
  );
  return res.status(201).json({ transaktion, guthabenCent });
});

// POST /transaktionen/:id/storno — Original-Transaktion regelkonform umkehren.
//
// Eine STORNO-Zeile ist eine neue Transaktion mit:
//   typ='STORNO', stornoVonId=Original.id, betragCent=-Original.betragCent,
//   userId=Original.userId, erstelltVonId=Auslöser, notiz=Pflicht.
//
// Live-Guthaben (§6.1) verrechnet das automatisch — keine separate Saldo-Logik.
//
// Regeln (§6.3, §4, §11):
//   - Selbst-Storno-Pfad: eigene KAUF-Transaktion innerhalb STORNO_FENSTER_MINUTEN
//     ist OHNE Notiz möglich (Auto-Notiz), egal ob Mitglied oder Admin. Admins
//     buchen auch selbst, deshalb darf der frictionless Undo nicht an der Rolle
//     hängen, sondern an der Bedingung.
//   - Admin-Fallback: für FREMDE Transaktionen, für nicht-KAUF, oder NACH Ablauf
//     des Fensters darf nur ein Admin stornieren, dann ist die Notiz Pflicht.
//   - Mitglied außerhalb der Selbst-Storno-Bedingung → 403.
//   - Keine Storno-Stornos: Original.typ='STORNO' → 400.
//   - Keine Doppel-Stornos: existiert schon STORNO mit stornoVonId=Original.id → 400.
//
// Hinweis Aufladungs-Storno (§6.3 Absatz 3): Bei AUFLADUNG_* müsste auch eine
// Kassen-Rückbuchung erfolgen. Da AufladungsAnfrage/KassenTransaktion erst
// B2e/B2f kommen, wird die gekoppelte Rückbuchung DORT ergänzt — nicht hier.
const stornoSchema = z.object({
  notiz: z.string().optional(),
});

buchenRouter.post('/transaktionen/:id/storno', async (req, res) => {
  const parsed = stornoSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Ungültige Eingaben.', details: parsed.error.flatten() });
  }

  const original = await prisma.transaktion.findUnique({ where: { id: req.params.id } });
  if (!original) return res.status(404).json({ error: 'Transaktion nicht gefunden.' });

  // Kein Storno eines Stornos (§11)
  if (original.typ === 'STORNO') {
    return res.status(400).json({ error: 'Eine Storno-Transaktion kann nicht storniert werden.' });
  }

  // Kein Doppel-Storno — schon eine STORNO-Zeile für dieses Original?
  const bereitsStorniert = await prisma.transaktion.findFirst({
    where: { typ: 'STORNO', stornoVonId: original.id },
    select: { id: true },
  });
  if (bereitsStorniert) {
    return res.status(400).json({ error: 'Diese Transaktion wurde bereits storniert.' });
  }

  const aktuellerUserId = req.auth!.sub;
  // Admin-Recht LIVE aus der DB lesen (Cleanup) — nicht aus dem JWT-Claim vom
  // Login-Zeitpunkt. So wirkt ein Rechtentzug (B2k-Demote) sofort; ein gerade
  // demoteter/inaktiver User kann keine fremden Transaktionen mehr stornieren.
  // Gleiches Muster wie requireAdmin/requireAdminOrLeitung (middleware.ts).
  const aktuellerUser = await prisma.user.findUnique({
    where: { id: aktuellerUserId },
    select: { isAdmin: true, isActive: true },
  });
  const istAdmin = !!aktuellerUser?.isActive && !!aktuellerUser.isAdmin;

  // Verzweigung an der BEDINGUNG, nicht an der Rolle — ein Admin, der eigene
  // KAUF im Fenster zurückrollt, soll genauso ohne Notiz durchkommen wie ein
  // Mitglied. Erst wenn die Selbst-Storno-Bedingung NICHT erfüllt ist, kommt
  // der Admin-Pflicht-Notiz-Pfad zum Tragen.
  const istEigenerKaufImFenster =
    original.userId === aktuellerUserId &&
    original.typ === 'KAUF' &&
    Date.now() - original.createdAt.getTime() <= STORNO_FENSTER_MINUTEN * 60 * 1000;

  let notiz: string;
  const erstelltVonId = aktuellerUserId;

  if (istEigenerKaufImFenster) {
    notiz = STORNO_AUTO_NOTIZ_MITGLIED;
  } else if (istAdmin) {
    // Admin storniert fremde / alte / nicht-KAUF: Pflicht-Notiz aus Body
    const trimmed = parsed.data.notiz?.trim() ?? '';
    if (!trimmed) {
      return res.status(400).json({ error: 'Notiz ist beim Admin-Storno Pflicht.' });
    }
    notiz = trimmed;
  } else {
    // Mitglied außerhalb der Selbst-Storno-Bedingung — genauere Fehlermeldung
    // hilft beim Debuggen im Browser/Test.
    if (original.userId !== aktuellerUserId) {
      return res.status(403).json({ error: 'Fremde Transaktion können nur Admins stornieren.' });
    }
    if (original.typ !== 'KAUF') {
      return res.status(403).json({ error: 'Mitglieder dürfen nur eigene Käufe stornieren.' });
    }
    return res
      .status(403)
      .json({ error: `Das ${STORNO_FENSTER_MINUTEN}-Minuten-Fenster ist abgelaufen.` });
  }

  // Bei Aufladungs-Storno (§6.3 Absatz 3) muss zusätzlich die gekoppelte
  // Kassen-Einzahlung per Gegen-KORREKTUR rückgebucht werden, atomar mit der
  // Mitglieder-STORNO-Zeile. Idiom-Wechsel auf $transaction, weil ab hier
  // jeder Aufladungs-Storno zwei Zeilen gegen verschiedene Tabellen schreibt.
  const istAufladung =
    original.typ === 'AUFLADUNG_BARGELD' || original.typ === 'AUFLADUNG_PAYPAL';
  const brauchtKassenGegenbuchung = istAufladung && original.kassenTransaktionId !== null;

  const { storno, kassenGegen } = await prisma.$transaction(async (tx) => {
    const stornoZeile = await tx.transaktion.create({
      data: {
        typ: 'STORNO',
        userId: original.userId,
        erstelltVonId,
        stornoVonId: original.id,
        betragCent: -original.betragCent,
        notiz,
      },
    });

    let gegen: Awaited<ReturnType<typeof tx.kassenTransaktion.create>> | null = null;
    if (brauchtKassenGegenbuchung) {
      const originalKasse = await tx.kassenTransaktion.findUnique({
        where: { id: original.kassenTransaktionId! },
      });
      if (originalKasse) {
        gegen = await tx.kassenTransaktion.create({
          data: {
            typ: 'KORREKTUR',
            konto: originalKasse.konto,
            verwalterId: originalKasse.verwalterId,
            betragCent: -originalKasse.betragCent,
            notiz: `Storno-Rückbuchung zu KassenTransaktion ${originalKasse.id}: ${notiz}`,
            erstelltVonId,
          },
        });
      }
    }

    return { storno: stornoZeile, kassenGegen: gegen };
  });

  const guthabenCent = await computeGuthabenCent(original.userId);
  logger.info(
    {
      userId: original.userId,
      ausgelöstVon: erstelltVonId,
      istAdmin,
      stornoId: storno.id,
      originalId: original.id,
      betragCent: storno.betragCent,
      kassenGegenId: kassenGegen?.id ?? null,
    },
    'Storno gebucht.',
  );
  return res.status(201).json({
    transaktion: storno,
    kassenGegenbuchung: kassenGegen,
    guthabenCent,
  });
});
