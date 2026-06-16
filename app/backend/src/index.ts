import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { env } from './env.js';
import { logger } from './logger.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { adminRouter } from './routes/admin.js';
import { drinksRouter } from './routes/drinks.js';
import { buchenRouter } from './routes/buchen.js';
import { aufladungRouter } from './routes/aufladung.js';
import { kasseRouter } from './routes/kasse.js';
import { statistikRouter } from './routes/statistik.js';
import { journalRouter } from './routes/journal.js';
import { accountRouter } from './routes/account.js';

export function buildApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));
  app.use(cookieParser());
  app.use(
    cors({
      origin: env.FRONTEND_ORIGIN,
      credentials: true,
    }),
  );

  app.use(healthRouter);
  app.use(authRouter);
  app.use(buchenRouter);
  app.use(journalRouter);
  // accountRouter (DELETE /me, GET /me/export) VOR adminRouter — sonst fängt
  // dessen globales requireAdmin die Member-Endpoints mit 403 ab.
  app.use(accountRouter);
  // aufladungRouter VOR adminRouter: adminRouter setzt sein requireAdmin global
  // an Mount '/' und würde sonst die Mitglieder-Endpoints (/aufladung/*) mit 403
  // abfangen, bevor sie hier ankommen. Die Admin-Routen in aufladungRouter haben
  // ihr eigenes requireAdmin pro Route.
  app.use(aufladungRouter);
  app.use(kasseRouter);
  app.use(statistikRouter);
  app.use(adminRouter);
  app.use(drinksRouter);

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error({ err }, 'Unbehandelter Fehler.');
    res.status(500).json({ error: 'Interner Serverfehler.' });
  });

  return app;
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const app = buildApp();
  app.listen(env.PORT, () => {
    logger.info(`Backend läuft auf http://localhost:${env.PORT}`);
    logger.info(`Erlaubter CORS-Origin: ${env.FRONTEND_ORIGIN}`);
  });
}
