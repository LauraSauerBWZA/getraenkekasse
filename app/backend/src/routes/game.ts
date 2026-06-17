import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth } from '../auth/middleware.js';
import { COOKIE_NAME, verifyJwt } from '../auth/jwt.js';
import { env } from '../env.js';

// Bestenliste fürs Bergwacht-Alpinist-Spiel (Phase B_GAME_ALPINIST).
//
// POST /game/scores            — Score speichern (Auth nötig)
// GET  /game/scores/leaderboard — Top-Scores (öffentlich, best-pro-User)
//
// WICHTIG bei der Montage in index.ts: dieser Router muss VOR dem adminRouter
// gemountet werden, dessen globales requireAdmin sonst die Game-Endpoints mit
// 403 abfängt.
export const gameRouter = Router();

// Auth fürs Spiel: regulär requireAuth. Im Standalone-Dev (Phase B_GAME) hat die
// Game-App keinen Session-Cookie (eigener Origin) — ohne Cookie fällt sie in
// Nicht-Produktion auf einen Stub-User (erster aktiver User) zurück, damit das
// Score-Speichern testbar ist. In Produktion gilt strikt requireAuth; der echte
// Auth-Flow kommt mit der React-Integration (B_GAME_INTEGRATION).
async function gameAuth(req: Request, res: Response, next: NextFunction) {
  const hasToken = Boolean(req.cookies?.[COOKIE_NAME]);
  if (hasToken || env.NODE_ENV === 'production') {
    return requireAuth(req, res, next);
  }
  const stub = await prisma.user.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!stub) return res.status(401).json({ error: 'Kein Dev-Stub-User vorhanden.' });
  req.auth = { sub: stub.id, sid: 'dev-stub', isAdmin: stub.isAdmin };
  return next();
}

// Liest die User-ID aus einem (optionalen) gültigen Cookie, ohne 401 zu werfen —
// für das isCurrentUser-Flag der öffentlichen Bestenliste.
function softUserId(req: Request): string | null {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  try {
    return verifyJwt(token).sub;
  } catch {
    return null;
  }
}

const scoreSchema = z.object({
  level: z.number().int().positive().max(99).default(1),
  score: z.number().int().min(0).max(1_000_000),
  timeMs: z
    .number()
    .int()
    .min(0)
    .max(60 * 60 * 1000),
  collectiblesFound: z.number().int().min(0).max(10_000).default(0),
  enemiesDefeated: z.number().int().min(0).max(10_000).default(0),
  livesLost: z.number().int().min(0).max(100).default(0),
});

gameRouter.post('/game/scores', gameAuth, async (req, res) => {
  const parsed = scoreSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: 'Ungültige Score-Daten.', details: parsed.error.flatten().fieldErrors });
  }

  const created = await prisma.gameScore.create({
    data: { userId: req.auth!.sub, ...parsed.data },
    select: { id: true, userId: true, level: true, score: true, createdAt: true },
  });
  return res.json(created);
});

gameRouter.get('/game/scores/leaderboard', async (req, res) => {
  const timeframe = String(req.query.timeframe ?? 'week');
  const since = new Date();
  if (timeframe === 'week') since.setDate(since.getDate() - 7);
  else if (timeframe === 'month') since.setMonth(since.getMonth() - 1);
  const where = timeframe === 'all' ? {} : { createdAt: { gte: since } };

  // Sortierung: Score absteigend, bei Gleichstand der frühere Lauf zuerst
  // (Tie-Break, Spec §12.6).
  const scores = await prisma.gameScore.findMany({
    where,
    orderBy: [{ score: 'desc' }, { createdAt: 'asc' }],
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
  });

  // Pro User nur den besten Lauf (erster Treffer in der sortierten Liste).
  const bestByUser = new Map<string, (typeof scores)[number]>();
  for (const s of scores) {
    if (!bestByUser.has(s.userId)) bestByUser.set(s.userId, s);
  }

  const currentUserId = softUserId(req);
  const leaderboard = [...bestByUser.values()].slice(0, 20).map((s, i) => ({
    rank: i + 1,
    userId: s.userId,
    userName: `${s.user.firstName} ${s.user.lastName}`.trim(),
    score: s.score,
    level: s.level,
    timeMs: s.timeMs,
    createdAt: s.createdAt,
    isCurrentUser: s.userId === currentUserId,
  }));

  return res.json({ leaderboard });
});
