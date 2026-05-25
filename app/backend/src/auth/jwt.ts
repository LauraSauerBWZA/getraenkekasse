import jwt from 'jsonwebtoken';
import { env } from '../env.js';

const ALG = 'HS256';
const TTL_DAYS = 7;
const TTL_SECONDS = TTL_DAYS * 24 * 60 * 60;

export interface JwtPayload {
  sub: string; // userId
  sid: string; // sessionId
  isAdmin: boolean;
}

export function signJwt(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { algorithm: ALG, expiresIn: TTL_SECONDS });
}

export function verifyJwt(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET, { algorithms: [ALG] }) as JwtPayload;
}

export const COOKIE_NAME = 'bwza_session';

export function sessionExpiry(): Date {
  return new Date(Date.now() + TTL_SECONDS * 1000);
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: env.NODE_ENV === 'production',
    path: '/',
    maxAge: TTL_SECONDS * 1000,
  };
}
