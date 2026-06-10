import { z } from 'zod';

// Drei feste Kategorien (KONFIGURATION.md §5.2, §11).
// Prisma-Enums sind auf SQLite nicht unterstützt → String + Zod-Validierung.
// Diese Konstante ist die Source of Truth für Backend-Validierung.
export const DRINK_KATEGORIEN = ['alkoholfrei', 'alkoholisch', 'sonstiges'] as const;

export type DrinkKategorie = (typeof DRINK_KATEGORIEN)[number];

export const drinkKategorieSchema = z.enum(DRINK_KATEGORIEN);
