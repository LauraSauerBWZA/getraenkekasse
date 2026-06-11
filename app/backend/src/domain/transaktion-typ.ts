import { z } from 'zod';

// Fünf Transaktions-Typen (KONFIGURATION.md §5.3).
// Prisma-Enums sind auf SQLite nicht unterstützt → String + Zod-Validierung.
// Alle Typen schon jetzt definiert, auch wenn B2c nur KAUF schreibt — die
// späteren Phasen (B2d Storno, B2e Bargeld, B2f PayPal, B2g Korrektur)
// erben sie ohne weitere Migration.
export const TRANSAKTION_TYPEN = [
  'KAUF',
  'AUFLADUNG_PAYPAL',
  'AUFLADUNG_BARGELD',
  'KORREKTUR',
  'STORNO',
] as const;

export type TransaktionTyp = (typeof TRANSAKTION_TYPEN)[number];

export const transaktionTypSchema = z.enum(TRANSAKTION_TYPEN);
