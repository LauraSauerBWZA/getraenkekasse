import { PrismaClient } from '@prisma/client';
import { generateInviteToken, inviteExpiry } from '../src/auth/tokens.js';
import { buildInviteUrl } from '../src/email/adapter.js';

const prisma = new PrismaClient();

const ADMIN_EMAIL = 'laura_sauer@gmx.de';

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });

  let user = existing;
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        firstName: 'Laura',
        lastName: 'Sauer',
        isAdmin: true,
        isActive: true,
      },
    });
    console.log(`✅ Admin angelegt: ${user.email}`);
  } else {
    console.log(`ℹ️  Admin existiert bereits: ${user.email}`);
  }

  // Wenn das Passwort noch nicht gesetzt ist, einen frischen Invite erzeugen
  if (!user.passwordHash) {
    const { clear, hash } = generateInviteToken();
    await prisma.inviteToken.create({
      data: { tokenHash: hash, userId: user.id, expiresAt: inviteExpiry() },
    });
    const url = buildInviteUrl(clear);
    console.log('\n' + '═'.repeat(64));
    console.log('🔑 MAGIC-LINK FÜR LAURA (Phase 1 — Dev-Modus, kein Email-Versand)');
    console.log('═'.repeat(64));
    console.log(url);
    console.log('═'.repeat(64) + '\n');
  } else {
    console.log('ℹ️  Passwort schon gesetzt — kein neuer Invite nötig. Bei Bedarf: pnpm db:reset && pnpm seed');
  }
}

main()
  .catch((err) => {
    console.error('Seed-Fehler:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
