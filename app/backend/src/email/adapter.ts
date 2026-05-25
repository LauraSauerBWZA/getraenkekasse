import { logger } from '../logger.js';
import { env } from '../env.js';

export interface InviteEmailPayload {
  to: string;
  firstName: string;
  inviteUrl: string;
}

export interface EmailAdapter {
  sendInvite(payload: InviteEmailPayload): Promise<void>;
}

/**
 * Dev-Adapter: gibt den Magic-Link in der Konsole aus.
 * Wird in einer späteren Phase durch einen SMTP-Adapter ersetzt.
 */
export class ConsoleEmailAdapter implements EmailAdapter {
  async sendInvite(payload: InviteEmailPayload): Promise<void> {
    logger.info(
      `\n  ┌──────────────────────────────────────────────\n  │ 📧 EMAIL (Dev-Konsole, kein echter Versand)\n  │\n  │   An:   ${payload.to}\n  │   Hi ${payload.firstName},\n  │\n  │   dein Magic-Link für die Bergwacht-Getränkekasse:\n  │   ${payload.inviteUrl}\n  │\n  │   Der Link ist 7 Tage lang gültig.\n  └──────────────────────────────────────────────\n`,
    );
  }
}

export function buildInviteUrl(clearToken: string): string {
  return `${env.APP_BASE_URL}/set-password?token=${encodeURIComponent(clearToken)}`;
}

export const email: EmailAdapter = new ConsoleEmailAdapter();
