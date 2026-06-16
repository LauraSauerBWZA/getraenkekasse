import { prisma } from '../db.js';
import { reassignOffeneAnfragen } from './lastverteilung.js';

// Geteilter Soft-Delete-Kern (KONFIGURATION.md §6.7) — genutzt vom Admin-Entfernen
// und der Selbstlöschung. Der Soft-Delete-Marker ist `User.isActive=false` (das
// reale Feld im Schema; §5.1 nennt historisch „deletedAt", existiert aber nicht).
//
// Atomar in EINER $transaction:
//  - isActive=false  → kein Login mehr (auth.ts) und kein requireAuth-Zugriff
//    (middleware.ts lehnt inaktive ab); aktive Sessions werden zusätzlich revoked,
//    damit der Ausschluss SOFORT wirkt (nicht erst bei Session-Ablauf).
//  - Kassen-Kopplung erhalten: gekoppelte KassenTransaktion-Einträge BLEIBEN
//    (das Geld war real in der Kasse), nur Transaktion.kassenTransaktionId wird
//    auf null gesetzt — der Kassenbestand bleibt unverfälscht.
//  - Mitglieder-Transaktionen bleiben bestehen (kein Hard-Delete, kein
//    Transaktion.deletedAt). Der Aggregat-Ausschluss (Statistik, Mitglieder-
//    Guthaben-Summe, Deckung) läuft über die User-Relation `isActive` — siehe
//    guthaben.ts + statistik.ts.
export async function softDeleteUser(userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { isActive: false } });
    // Kasse entkoppeln (Kopplung auf null) — KassenTransaktion bleibt erhalten.
    await tx.transaktion.updateMany({
      where: { userId, kassenTransaktionId: { not: null } },
      data: { kassenTransaktionId: null },
    });
    // Offene Sessions sofort beenden.
    await tx.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });

  // War der entfernte User ein Verwalter, seine OFFENEN PayPal-Anfragen dem least-
  // loaded verbliebenen Verwalter neu zuweisen (Cleanup) — sonst hingen sie
  // unbestätigbar fest. Nach der Transaktion (User ist jetzt inaktiv → vom
  // Reassign-Ziel ohnehin ausgeschlossen). Für Nicht-Verwalter: 0 Zeilen, no-op.
  await reassignOffeneAnfragen(userId);
}

// Letzter-Admin-Schutz (wiederverwendet aus B2k): true, wenn `userId` ein aktiver
// Admin ist und es keinen weiteren aktiven Admin gibt. Verhindert, dass die App
// per Löschung ohne Verwalter dastünde.
export async function istLetzterAktiverAdmin(userId: string): Promise<boolean> {
  const ziel = await prisma.user.findUnique({
    where: { id: userId },
    select: { isAdmin: true, isActive: true },
  });
  if (!ziel || !ziel.isAdmin || !ziel.isActive) return false;
  const aktiveAdmins = await prisma.user.count({ where: { isAdmin: true, isActive: true } });
  return aktiveAdmins <= 1;
}

// Verwalter-Topf-Saldo (Σ VERWALTER-Buchungen). Für die Lösch-Warnung „Topf ≠ 0
// vorher ausgleichen/übergeben" (§6.7) — warnen, nicht blockieren.
export async function verwalterTopfCent(userId: string): Promise<number> {
  const agg = await prisma.kassenTransaktion.aggregate({
    _sum: { betragCent: true },
    where: { konto: 'VERWALTER', verwalterId: userId },
  });
  return agg._sum.betragCent ?? 0;
}
