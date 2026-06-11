import { z } from 'zod';

// Zwei Kassen-Konten (KONFIGURATION.md §5.6, §6.8).
// VERWALTER: ein Topf pro Verwalter, darf negativ werden („Schuld-Modell").
// BOX: die physische Bar-Vereinskasse, nachzählbar.
// String + Zod-Validierung, weil SQLite keine Prisma-Enums unterstützt.
export const KASSEN_KONTEN = ['VERWALTER', 'BOX'] as const;

export type KassenKonto = (typeof KASSEN_KONTEN)[number];

export const kassenKontoSchema = z.enum(KASSEN_KONTEN);
