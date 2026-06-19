import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAdmin, requireAuth } from '../auth/middleware.js';
import { drinkKategorieSchema } from '../domain/drink-kategorien.js';
import { logger } from '../logger.js';

export const drinksRouter = Router();

drinksRouter.use(requireAuth, requireAdmin);

// Etikett-Bild (Drink-Fotos): komprimierte JPEG-Data-URL. Sicherheits-Obergrenze
// ~200 KB String-Länge (das Frontend liefert ~30–50 KB); muss als JPEG-Data-URL
// kommen. `null`/`''` entfernt das Bild. Eigene Validierung mit klaren Meldungen.
const BILD_PREFIX = 'data:image/jpeg;base64,';
const MAX_BILD_LEN = 200 * 1024;

// Liefert eine klare Fehlermeldung oder null (gültig). Akzeptiert auch leeren
// String / null (= Bild entfernen). undefined wird vom Aufrufer separat behandelt.
function pruefeBild(bild: string | null): string | null {
  if (bild === null || bild === '') return null; // entfernen → ok
  if (!bild.startsWith(BILD_PREFIX)) {
    return 'Bild muss ein JPEG (data:image/jpeg;base64,…) sein.';
  }
  if (bild.length > MAX_BILD_LEN) {
    return 'Bild ist zu groß (max ~200 KB) — bitte erneut auswählen.';
  }
  return null;
}

// name: nicht leer, max 80 Zeichen
// preisCent: ganzzahlig, >= 0 (kostenlose Drinks erlaubt, negativ nicht)
// icon: optional, Emoji-String, max 8 Zeichen (Emoji + ggf. Modifier)
// kategorie: aus fester Liste
// marke: optional, max 40 Zeichen (leer = nicht gesetzt)
// volumenMl: optional, ganzzahlig > 0 wenn gesetzt; null löscht den Wert (Update)
// bildDataUrl: optional, string|null; Inhalt wird per pruefeBild() validiert.
const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  preisCent: z.number().int().min(0),
  icon: z.string().trim().max(8).optional(),
  kategorie: drinkKategorieSchema,
  marke: z.string().trim().max(40).optional(),
  volumenMl: z.number().int().positive().nullable().optional(),
  bildDataUrl: z.string().nullable().optional(),
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

  // Bild separat validieren (klare Meldung). undefined = kein Bild → null.
  const bildRaw = parsed.data.bildDataUrl ?? null;
  const bildFehler = pruefeBild(bildRaw);
  if (bildFehler) return res.status(400).json({ error: bildFehler });

  const drink = await prisma.drink.create({
    data: {
      name: parsed.data.name,
      preisCent: parsed.data.preisCent,
      icon: parsed.data.icon ?? null,
      kategorie: parsed.data.kategorie,
      // leere Marke → null; Volumen null/undefined → null (nicht gesetzt)
      marke: parsed.data.marke ? parsed.data.marke : null,
      volumenMl: parsed.data.volumenMl ?? null,
      bildDataUrl: bildRaw === '' ? null : bildRaw,
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
  // marke: leerer String löscht (→ null), wie beim icon. volumenMl: null löscht.
  if (parsed.data.marke !== undefined) data.marke = parsed.data.marke === '' ? null : parsed.data.marke;
  if (parsed.data.volumenMl !== undefined) data.volumenMl = parsed.data.volumenMl;
  // bildDataUrl: null/'' entfernt das Bild, sonst validierte Data-URL setzen.
  if (parsed.data.bildDataUrl !== undefined) {
    const bildFehler = pruefeBild(parsed.data.bildDataUrl);
    if (bildFehler) return res.status(400).json({ error: bildFehler });
    data.bildDataUrl = parsed.data.bildDataUrl === '' ? null : parsed.data.bildDataUrl;
  }

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
