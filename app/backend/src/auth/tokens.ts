import { createHash, randomBytes } from 'node:crypto';

const TOKEN_BYTES = 32; // 256 Bit Entropie
const INVITE_TTL_DAYS = 7;

export function generateInviteToken(): { clear: string; hash: string } {
  const clear = randomBytes(TOKEN_BYTES).toString('base64url');
  const hash = hashToken(clear);
  return { clear, hash };
}

export function hashToken(clear: string): string {
  return createHash('sha256').update(clear).digest('hex');
}

export function inviteExpiry(): Date {
  return new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
}
