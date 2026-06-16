import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

const isProd = env.NODE_ENV === 'production';

// Gebautes Frontend (B8): von backend/dist/index.js aus liegt frontend/dist unter
// ../../frontend/dist. ESM-tauglich über import.meta.url aufgelöst (cwd-unabhängig,
// damit es auch unter systemd mit beliebiger WorkingDirectory stimmt).
const FRONTEND_DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend/dist');

export function buildApp() {
  const app = express();
  app.disable('x-powered-by');

  // Hinter Caddy terminiert HTTPS; Express sieht http auf 127.0.0.1. `trust proxy`
  // lässt Express `X-Forwarded-Proto`/`-For` von Caddy auswerten → `req.secure`
  // korrekt, sodass die Secure-Cookie-Session (cookieOptions, NODE_ENV=production)
  // hält. Nur in Prod — in Dev steht kein Proxy davor.
  if (isProd) app.set('trust proxy', 1);

  app.use(express.json({ limit: '256kb' }));
  app.use(cookieParser());

  // CORS nur in Dev: dort spricht das Frontend (Vite :3001 bzw. direkter Origin)
  // das Backend cross-origin an. In Prod ist alles same-origin (ein Dienst, ein
  // Port) → CORS unnötig und bewusst aus.
  if (!isProd) {
    app.use(
      cors({
        origin: env.FRONTEND_ORIGIN,
        credentials: true,
      }),
    );
  }

  // Alle API-Router gebündelt. In Prod unter '/api' gemountet — exakt der Pfad,
  // den das gebaute Frontend nutzt (VITE_API_URL=/api), da dort kein Vite-Proxy
  // das Präfix wegschreibt. In Dev an Root (der Dev-Client trifft das Backend
  // direkt/über den Proxy-Rewrite an Root) → Dev-Verhalten unverändert.
  const apiRouter = express.Router();
  apiRouter.use(healthRouter);
  apiRouter.use(authRouter);
  apiRouter.use(buchenRouter);
  apiRouter.use(journalRouter);
  // accountRouter (DELETE /me, GET /me/export) VOR adminRouter — sonst fängt
  // dessen globales requireAdmin die Member-Endpoints mit 403 ab.
  apiRouter.use(accountRouter);
  // aufladungRouter VOR adminRouter: adminRouter setzt sein requireAdmin global
  // an Mount '/' und würde sonst die Mitglieder-Endpoints (/aufladung/*) mit 403
  // abfangen, bevor sie hier ankommen. Die Admin-Routen in aufladungRouter haben
  // ihr eigenes requireAdmin pro Route.
  apiRouter.use(aufladungRouter);
  apiRouter.use(kasseRouter);
  apiRouter.use(statistikRouter);
  apiRouter.use(adminRouter);
  apiRouter.use(drinksRouter);

  app.use(isProd ? '/api' : '/', apiRouter);

  // Prod: das eine Express bedient zusätzlich das gebaute Frontend. Reihenfolge
  // strikt: API (oben) → Static → SPA-Fallback. Der Fallback liefert index.html
  // für Nicht-API-Routen (Deep-Link/Refresh auf /admin, /buchen, …), darf aber
  // keine API-Requests schlucken (deshalb /api-Guard) und keine Assets (die holt
  // express.static davor ab).
  if (isProd) {
    app.use(express.static(FRONTEND_DIST));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
    });
  }

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error({ err }, 'Unbehandelter Fehler.');
    res.status(500).json({ error: 'Interner Serverfehler.' });
  });

  return app;
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const app = buildApp();
  // Prod: nur an 127.0.0.1 lauschen (Caddy proxyt davor, kein direkter Zugriff
  // von außen). Dev: 0.0.0.0, damit der gemappte Container-Port vom Mac-Browser
  // erreichbar ist.
  const host = isProd ? '127.0.0.1' : '0.0.0.0';
  app.listen(env.PORT, host, () => {
    logger.info(`Backend läuft auf http://${host}:${env.PORT} (NODE_ENV=${env.NODE_ENV})`);
    if (isProd) {
      logger.info(`Prod: API unter /api, Frontend aus ${FRONTEND_DIST} (same-origin, kein CORS)`);
    } else {
      logger.info(`Dev: API an Root, erlaubter CORS-Origin: ${env.FRONTEND_ORIGIN}`);
    }
  });
}
