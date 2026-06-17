import { prisma } from '../db.js';
import { computeGuthabenCent } from './guthaben.js';

// Datenexport (Account-A §3.4, DSGVO §9) — gemeinsamer Serialisierungs-Kern.
// Seit „Export admin-exklusiv": der frühere Mitglieder-Selbst-Export (/me/export)
// ist entfernt; exportieren darf nur noch der Admin, einzeln oder gesamt.

// Eine Mitglieder-Transaktion in Export-Form (inkl. Drink-Name bei KAUF).
function serialisiereTransaktionen(
  txs: Array<{ id: string; typ: string; betragCent: number; drink: { name: string } | null; notiz: string | null; createdAt: Date }>,
) {
  return txs.map((t) => ({
    id: t.id,
    typ: t.typ,
    betragCent: t.betragCent,
    drinkName: t.drink?.name ?? null,
    notiz: t.notiz,
    createdAt: t.createdAt,
  }));
}

// Kern-Export EINES Mitglieds — exakt die Form des früheren /me/export (ohne den
// Wrapper exportiertAm/hinweis, den die Route ergänzt): Profil + eigene
// Transaktionen (inkl. Drink-Name) + eigene Aufladungs-Anfragen + Live-Guthaben.
// `null`, wenn die ID kein User ist (Route → 404).
export async function buildMemberExport(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      isAdmin: true,
      isLeitung: true,
      createdAt: true,
    },
  });
  if (!user) return null;

  const [txs, anfragen, guthabenCent] = await Promise.all([
    prisma.transaktion.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { drink: { select: { name: true } } },
    }),
    prisma.aufladungsAnfrage.findMany({
      where: { userId },
      orderBy: { requestedAt: 'desc' },
      select: {
        id: true,
        betragCent: true,
        status: true,
        requestedAt: true,
        decidedAt: true,
        adminNotiz: true,
      },
    }),
    computeGuthabenCent(userId),
  ]);

  return {
    profil: {
      id: user.id,
      vorname: user.firstName,
      nachname: user.lastName,
      email: user.email,
      rollen: { admin: user.isAdmin, leitung: user.isLeitung },
      mitgliedSeit: user.createdAt,
      guthabenCent,
    },
    transaktionen: serialisiereTransaktionen(txs),
    aufladungsAnfragen: anfragen,
  };
}

// Gesamt-Export: alle AKTIVEN Mitglieder mit ihren Transaktionen (pro User ein
// Block) plus alle Kassen-Transaktionen und der vollständige Drink-Katalog (inkl.
// inaktiver Sorten — Audit-Vollständigkeit). Soft-gelöschte (inaktive) User
// bleiben außen vor, konsistent mit der aktiven Mitgliederliste.
export async function buildGesamtExport() {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      isAdmin: true,
      isLeitung: true,
      createdAt: true,
    },
  });

  const mitglieder = await Promise.all(
    users.map(async (u) => {
      const txs = await prisma.transaktion.findMany({
        where: { userId: u.id },
        orderBy: { createdAt: 'desc' },
        include: { drink: { select: { name: true } } },
      });
      return {
        profil: {
          id: u.id,
          vorname: u.firstName,
          nachname: u.lastName,
          email: u.email,
          rollen: { admin: u.isAdmin, leitung: u.isLeitung },
          mitgliedSeit: u.createdAt,
          guthabenCent: await computeGuthabenCent(u.id),
        },
        transaktionen: serialisiereTransaktionen(txs),
      };
    }),
  );

  const kassenTransaktionen = await prisma.kassenTransaktion.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      typ: true,
      konto: true,
      verwalterId: true,
      betragCent: true,
      notiz: true,
      transaktionId: true,
      erstelltVonId: true,
      createdAt: true,
    },
  });

  const drinkKatalog = await prisma.drink.findMany({
    orderBy: [{ kategorie: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      preisCent: true,
      icon: true,
      kategorie: true,
      marke: true,
      volumenMl: true,
      isActive: true,
      createdAt: true,
    },
  });

  return { mitglieder, kassenTransaktionen, drinkKatalog };
}
