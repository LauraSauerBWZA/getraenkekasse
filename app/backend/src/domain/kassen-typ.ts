import { z } from 'zod';

// Sechs Kassen-Transaktions-Typen (KONFIGURATION.md §5.6, Update 9).
// Prisma-Enums sind auf SQLite nicht unterstützt → String + Zod-Validierung.
// B2e schreibt nur EINZAHLUNG (Bargeld-Aufladung) und KORREKTUR (Aufladungs-
// Storno-Rückbuchung); der B2i-Kassen-Screen nutzt EINKAUF/ENTNAHME/EINLAGE_BOX/
// SPENDE/KORREKTUR. Der frühere Privat-Vorstreck-Typ entfiel in Update 9 —
// redundant zu EINKAUF/ENTNAHME aus dem eigenen Topf, der negativ werden darf.
export const KASSEN_TYPEN = [
  'EINZAHLUNG',
  'EINLAGE_BOX',
  'EINKAUF',
  'ENTNAHME',
  'SPENDE',
  'KORREKTUR',
] as const;

export type KassenTyp = (typeof KASSEN_TYPEN)[number];

export const kassenTypSchema = z.enum(KASSEN_TYPEN);
