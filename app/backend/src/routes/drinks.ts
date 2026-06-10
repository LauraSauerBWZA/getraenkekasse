import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAdmin, requireAuth } from '../auth/middleware.js';
import { drinkKategorieSchema } from '../domain/drink-kategorien.js';
import { logger } from '../logger.js';

export const drinksRouter = Router();

drinksRouter.use(requireAuth, requireAdmin);

// name: nicht leer, max 80 Zeichen
// preisCent: ganzzahlig, >= 0 (kostenlose Drinks erlaubt, negativ nicht)
// icon: optional, Emoji-String, max 8 Zeichen (Emoji + ggf. Modifier)
// kategorie: aus fester Liste
const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  preisCent: z.number().int().min(0),
  icon: z.string().trim().max(8).optional(),
  kategorie: drinkKategorieSchema,
});

const updateSchema = createSchema.partial().refine(
  (val) => Object.keys(val).length > 0,
  { message: 'Mindestens ein Feld muss angegeben sein.' },
);

const activeSchema = z.object({
  isActive: z.boolean(),
});

// GET /admin/drinks — alle Drinks inkl. inaktive, für die Verwaltung
drinksRouter.get('/admin/drinks', async (_req, res) => {
  const drinks = await prisma.drink.findMany({
    orderBy: [{ kategorie: 'asc' }, { name: 'asc' }],
  });
  return res.json({ drinks });
});

// POST /admin/drinks — neuen Drink anlegen
drinksRouter.post('/admin/drinks', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Ungültige Eingaben.', details: parsed.error.flatten() });
  }

  const drink = await prisma.drink.create({
    data: {
      name: parsed.data.name,
      preisCent: parsed.data.preisCent,
      icon: parsed.data.icon ?? null,
      kategorie: parsed.data.kategorie,
    },
  });

  logger.info({ drinkId: drink.id, name: drink.name }, 'Drink angelegt.');
  return res.status(201).json({ drink });
});

// PATCH /admin/drinks/:id — Drink bearbeiten (Felder einzeln)
drinksRouter.patch('/admin/drinks/:id', async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Ungültige Eingaben.', details: parsed.error.flatten() });
  }

  const existing = await prisma.drink.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Drink nicht gefunden.' });

  // icon kann explizit auf leer („kein Icon mehr") gesetzt werden → null in DB
  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.preisCent !== undefined) data.preisCent = parsed.data.preisCent;
  if (parsed.data.icon !== undefined) data.icon = parsed.data.icon === '' ? null : parsed.data.icon;
  if (parsed.data.kategorie !== undefined) data.kategorie = parsed.data.kategorie;

  const drink = await prisma.drink.update({ where: { id: existing.id }, data });
  logger.info({ drinkId: drink.id }, 'Drink aktualisiert.');
  return res.json({ drink });
});

// PATCH /admin/drinks/:id/active — Soft-Disable/Enable
drinksRouter.patch('/admin/drinks/:id/active', async (req, res) => {
  const parsed = activeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Ungültige Eingaben.', details: parsed.error.flatten() });
  }

  const existing = await prisma.drink.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Drink nicht gefunden.' });

  const drink = await prisma.drink.update({
    where: { id: existing.id },
    data: { isActive: parsed.data.isActive },
  });
  logger.info({ drinkId: drink.id, isActive: drink.isActive }, 'Drink-Aktiv-Status geändert.');
  return res.json({ drink });
});
