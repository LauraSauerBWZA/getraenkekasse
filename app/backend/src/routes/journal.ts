import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../auth/middleware.js';
import { computeGuthabenCent } from '../domain/guthaben.js';

export const journalRouter = Router();

// Tagesschlüssel yyyy-mm-dd in **Europe/Berlin** (B5a), dependency-frei via Intl.
// CET/CEST (DST) behandelt Intl korrekt. en-CA liefert das ISO-Format yyyy-mm-dd.
const BERLIN_DATE_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const BERLIN_WEEKDAY_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Berlin',
  weekday: 'short',
});

export function berlinDayKey(d: Date): string {
  return BERLIN_DATE_FMT.format(d);
}

// Tagesarithmetik auf dem Berlin-Tagesschlüssel mit **UTC-Noon-Anker**: 12:00 UTC
// eines Kalendertags liegt in Berlin am frühen Nachmittag (13:00/14:00) — die
// 12h-Marge zur Mitternacht macht ±24h-Sprünge DST-sicher (eine 23h-/25h-Stunde
// kippt den Tag nie).
function keyAnchor(key: string): Date {
  return new Date(key + 'T12:00:00Z');
}
function shiftKey(key: string, days: number): string {
  return berlinDayKey(new Date(keyAnchor(key).getTime() + days * 86_400_000));
}
function istWochenendeKey(key: string): boolean {
  const wd = BERLIN_WEEKDAY_FMT.format(keyAnchor(key));
  return wd === 'Sat' || wd === 'Sun';
}
// Mo=0 … So=6, in Berlin.
function berlinWochentagMontag0(key: string): number {
  const wd = BERLIN_WEEKDAY_FMT.format(keyAnchor(key));
  const idx = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd);
  return (idx + 6) % 7;
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

  // Tages- und Monatszähler (Berlin-Tagesschlüssel).
  const dayCounts = new Map<string, number>();
  const monatsZaehler = new Map<string, number>();
  for (const k of gueltige) {
    const key = berlinDayKey(k.createdAt);
    dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
    const mk = key.slice(0, 7);
    monatsZaehler.set(mk, (monatsZaehler.get(mk) ?? 0) + 1);
  }

  const heuteKey = berlinDayKey(new Date());
  const monatKey = heuteKey.slice(0, 7);

  // Hero: gültige Käufe im laufenden Kalendermonat.
  const heroMonat = monatsZaehler.get(monatKey) ?? 0;

  // Diese Woche (Montag-basiert, Berlin).
  const wocheStartKey = shiftKey(heuteKey, -berlinWochentagMontag0(heuteKey));
  let dieseWoche = 0;
  for (const [key, count] of dayCounts) {
    if (key >= wocheStartKey && key <= heuteKey) dieseWoche += count;
  }

  // Streak: aufeinanderfolgende Tage bis heute mit >=1 Buchung (heute 0 → 0).
  let streak = 0;
  let cursor = heuteKey;
  while ((dayCounts.get(cursor) ?? 0) > 0) {
    streak++;
    cursor = shiftKey(cursor, -1);
  }

  // Längste Pause: längste lückenlose Folge buchungsfreier Tage zwischen erstem
  // Kauf und heute (inkl. aktuellem Trailing-Gap). Vor dem ersten Kauf zählt
  // nichts als Pause.
  let laengstePause = 0;
  if (gueltige.length > 0) {
    const minMs = Math.min(...gueltige.map((k) => k.createdAt.getTime()));
    let key = berlinDayKey(new Date(minMs));
    let run = 0;
    while (key <= heuteKey) {
      if ((dayCounts.get(key) ?? 0) > 0) {
        run = 0;
      } else {
        run++;
        if (run > laengstePause) laengstePause = run;
      }
      key = shiftKey(key, 1);
    }
  }

  // 30-Tage-Verlauf (älteste zuerst), Wochenenden für die Amber-Deep-Färbung.
  const verlauf30 = [];
  for (let i = 29; i >= 0; i--) {
    const key = shiftKey(heuteKey, -i);
    verlauf30.push({ datum: key, anzahl: dayCounts.get(key) ?? 0, istWochenende: istWochenendeKey(key) });
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
