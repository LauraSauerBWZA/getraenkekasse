import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../auth/middleware.js';
import { computeGuthabenCent } from '../domain/guthaben.js';

export const journalRouter = Router();

// Tagesschlüssel yyyy-mm-dd (UTC). Im Container ist TZ=UTC → deterministisch +
// testbar; ein Berlin-Feinabgleich wäre Politur (B5/B6).
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

// Hamster-Interpretation (dokumentiert): Live-Berechnung kann keine Historie der
// Guthaben-Stände kennen → freigeschaltet, wenn das AKTUELLE Guthaben über 50 €
// liegt.
const HAMSTER_SCHWELLE_CENT = 5000;

// Alles in diesem Router ist STRIKT eigene Daten (KONFIGURATION §7.4): jeder
// Endpoint nutzt req.auth.sub, NIE ein :userId-Param. Kein Admin-/Leitung-Zugriff
// auf fremde Journale — das Trinkjournal ist privat, auch vor der Leitung.
journalRouter.use(requireAuth);

// GET /me/transaktionen — eigene Transaktions-Historie, chronologisch absteigend.
// Zeigt pro Buchung den Drink-Namen (eigene Daten, Transparenz, konsistent mit
// dem DSGVO-Datenexport §9). storniert = es existiert ein STORNO, das darauf
// verweist. dabeiSeitTage aus User.createdAt für den „seit N Tagen dabei"-Footer.
journalRouter.get('/me/transaktionen', async (req, res) => {
  const userId = req.auth!.sub;

  const [user, txs] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
    prisma.transaktion.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { drink: { select: { name: true } } },
    }),
  ]);
  if (!user) return res.status(404).json({ error: 'User nicht gefunden.' });

  const stornierteIds = new Set(
    txs.filter((t) => t.typ === 'STORNO' && t.stornoVonId).map((t) => t.stornoVonId as string),
  );

  const transaktionen = txs.map((t) => ({
    id: t.id,
    typ: t.typ,
    betragCent: t.betragCent,
    notiz: t.notiz,
    drinkName: t.drink?.name ?? null,
    stornoVonId: t.stornoVonId,
    createdAt: t.createdAt,
    storniert: stornierteIds.has(t.id),
  }));

  const dabeiSeitTage = Math.floor((Date.now() - user.createdAt.getTime()) / 86_400_000);

  return res.json({ transaktionen, dabeiSeitTage });
});

// GET /journal — privates Trinkjournal, eigene Daten (req.auth.sub).
// SORTENAGNOSTISCH (HART, §9/§11): rechnet nur mit Anzahl/Beträgen — kein
// Drink-Bezug, kein „Lieblingsgetränk". Stornierte Käufe zählen NICHT.
journalRouter.get('/journal', async (req, res) => {
  const userId = req.auth!.sub;

  // Gültige Käufe = typ=KAUF, nicht storniert.
  const kaeufe = await prisma.transaktion.findMany({
    where: { typ: 'KAUF', userId },
    select: { id: true, createdAt: true },
  });
  const kaufIds = kaeufe.map((k) => k.id);
  const stornos =
    kaufIds.length > 0
      ? await prisma.transaktion.findMany({
          where: { typ: 'STORNO', userId, stornoVonId: { in: kaufIds } },
          select: { stornoVonId: true },
        })
      : [];
  const stornierte = new Set(stornos.map((s) => s.stornoVonId));
  const gueltige = kaeufe.filter((k) => !stornierte.has(k.id));

  // Tages- und Monatszähler.
  const dayCounts = new Map<string, number>();
  const monatsZaehler = new Map<string, number>();
  for (const k of gueltige) {
    const key = dayKey(k.createdAt);
    dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
    const mk = key.slice(0, 7);
    monatsZaehler.set(mk, (monatsZaehler.get(mk) ?? 0) + 1);
  }

  const now = new Date();
  const heuteKey = dayKey(now);
  const monatKey = heuteKey.slice(0, 7);

  // Hero: gültige Käufe im laufenden Kalendermonat.
  const heroMonat = monatsZaehler.get(monatKey) ?? 0;

  // Diese Woche (Montag-basiert).
  const seitMontag = (now.getUTCDay() + 6) % 7;
  const wocheStartKey = dayKey(addDays(now, -seitMontag));
  let dieseWoche = 0;
  for (const [key, count] of dayCounts) {
    if (key >= wocheStartKey && key <= heuteKey) dieseWoche += count;
  }

  // Streak: aufeinanderfolgende Tage bis heute mit >=1 Buchung (heute 0 → 0).
  let streak = 0;
  let cursor = now;
  while ((dayCounts.get(dayKey(cursor)) ?? 0) > 0) {
    streak++;
    cursor = addDays(cursor, -1);
  }

  // Längste Pause: längste lückenlose Folge buchungsfreier Tage zwischen erstem
  // Kauf und heute (inkl. aktuellem Trailing-Gap). Vor dem ersten Kauf zählt
  // nichts als Pause.
  let laengstePause = 0;
  if (gueltige.length > 0) {
    const minMs = Math.min(...gueltige.map((k) => k.createdAt.getTime()));
    let d = new Date(minMs);
    let run = 0;
    while (dayKey(d) <= heuteKey) {
      if ((dayCounts.get(dayKey(d)) ?? 0) > 0) {
        run = 0;
      } else {
        run++;
        if (run > laengstePause) laengstePause = run;
      }
      d = addDays(d, 1);
    }
  }

  // 30-Tage-Verlauf (älteste zuerst), Wochenenden für die Amber-Deep-Färbung.
  const verlauf30 = [];
  for (let i = 29; i >= 0; i--) {
    const d = addDays(now, -i);
    const key = dayKey(d);
    const wd = d.getUTCDay();
    verlauf30.push({ datum: key, anzahl: dayCounts.get(key) ?? 0, istWochenende: wd === 0 || wd === 6 });
  }

  // Achievements (live abgeleitet, keine Persistenz).
  const gesamt = gueltige.length;
  const maxProTag = dayCounts.size > 0 ? Math.max(...dayCounts.values()) : 0;
  const maxProMonat = monatsZaehler.size > 0 ? Math.max(...monatsZaehler.values()) : 0;
  const guthabenCent = await computeGuthabenCent(userId);

  const achievements = [
    { key: 'erstbesteigung', emoji: '🏔️', titel: 'Erstbesteigung', beschreibung: 'Erstes Getränk gebucht.', freigeschaltet: gesamt >= 1 },
    { key: 'trockenwoche', emoji: '🌧️', titel: 'Trockenwoche', beschreibung: '7 Tage am Stück nichts gebucht.', freigeschaltet: laengstePause >= 7 },
    { key: 'huettenabend', emoji: '⛺', titel: 'Hüttenabend', beschreibung: '3 Getränke an einem Tag.', freigeschaltet: maxProTag >= 3 },
    { key: 'tourenrucksack', emoji: '🎒', titel: 'Tourenrucksack', beschreibung: '20 Getränke in einem Kalendermonat.', freigeschaltet: maxProMonat >= 20, fortschritt: { ist: heroMonat, ziel: 20 } },
    { key: 'hamster', emoji: '🪙', titel: 'Hamster', beschreibung: 'Guthaben über 50 €.', freigeschaltet: guthabenCent > HAMSTER_SCHWELLE_CENT },
    { key: 'stammgast', emoji: '🎖️', titel: 'Stammgast', beschreibung: '100 Buchungen gesamt.', freigeschaltet: gesamt >= 100, fortschritt: { ist: gesamt, ziel: 100 } },
    { key: 'seilschaft', emoji: '🧗', titel: 'Seilschaft', beschreibung: 'Eine Runde ausgeben — kommt später.', freigeschaltet: false, gesperrt: true },
  ];

  return res.json({
    heroMonat,
    dieseWoche,
    streak,
    laengstePause,
    gesamtKaeufe: gesamt,
    verlauf30,
    achievements,
  });
});
