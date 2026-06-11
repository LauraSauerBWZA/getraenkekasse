import { z } from 'zod';

// Sieben Kassen-Transaktions-Typen (KONFIGURATION.md §5.6).
// Prisma-Enums sind auf SQLite nicht unterstützt → String + Zod-Validierung.
// Alle Typen schon jetzt definiert, auch wenn B2e nur EINZAHLUNG (Bargeld-
// Aufladung) und KORREKTUR (Aufladungs-Storno-Rückbuchung) schreibt — die
// späteren Phasen (B2i Kassen-Screen mit EINKAUF/ENTNAHME/EINLAGE_BOX/
// AUSLAGE/SPENDE) erben sie ohne weitere Migration.
export const KASSEN_TYPEN = [
  'EINZAHLUNG',
  'EINLAGE_BOX',
  'EINKAUF',
  'ENTNAHME',
  'AUSLAGE',
  'SPENDE',
  'KORREKTUR',
] as const;

export type KassenTyp = (typeof KASSEN_TYPEN)[number];

export const kassenTypSchema = z.enum(KASSEN_TYPEN);
