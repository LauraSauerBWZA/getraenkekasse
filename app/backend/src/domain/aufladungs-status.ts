import { z } from 'zod';

// State-Machine der PayPal-Aufladungs-Anfrage (KONFIGURATION.md §5.5, §6.5).
// OFFEN → BESTAETIGT (gekoppelte Buchung) ODER OFFEN → ABGELEHNT (keine Buchung).
// Eine entschiedene Anfrage (BESTAETIGT/ABGELEHNT) ist terminal.
// Prisma-Enums sind auf SQLite nicht unterstützt → String + Zod-Validierung,
// analog zu transaktion-typ.ts / kassen-typ.ts / kassen-konto.ts.
export const AUFLADUNGS_STATUS = ['OFFEN', 'BESTAETIGT', 'ABGELEHNT'] as const;

export type AufladungsStatus = (typeof AUFLADUNGS_STATUS)[number];

export const aufladungsStatusSchema = z.enum(AUFLADUNGS_STATUS);
