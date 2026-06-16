// Robuste Express-Request-Augmentation (Cleanup vor Deploy). Ersetzt die fragile
// Inline-`declare module`-Deklaration aus auth/middleware.ts durch eine dedizierte
// ambient .d.ts, die im Build (tsconfig.build.json, include src/**/*) zuverlässig
// mitgezogen wird. `req.auth` trägt das verifizierte JWT-Payload (von requireAuth
// gesetzt). Rollen werden trotzdem live aus der DB gelesen (middleware.ts) — der
// `isAdmin`-Claim hier ist nur der denormalisierte Login-Zeitpunkt-Stand.
import type { JwtPayload } from '../auth/jwt.js';

declare global {
  namespace Express {
    interface Request {
      auth?: JwtPayload;
    }
  }
}

export {};
