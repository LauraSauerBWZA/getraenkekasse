import { PrismaClient } from '@prisma/client';
import { generateInviteToken, inviteExpiry } from '../src/auth/tokens.js';
import { buildInviteUrl } from '../src/email/adapter.js';
import { DRINK_KATEGORIEN, type DrinkKategorie } from '../src/domain/drink-kategorien.js';

const prisma = new PrismaClient();

const ADMIN_EMAIL = 'laura_sauer@gmx.de';

interface DrinkSeed {
  name: string;
  preisCent: number;
  icon: string;
  kategorie: DrinkKategorie;
}

const DRINK_SEEDS: DrinkSeed[] = [
  { name: 'Cola', icon: '🥤', preisCent: 150, kategorie: 'alkoholfrei' },
  { name: 'Wasser', icon: '💧', preisCent: 100, kategorie: 'alkoholfrei' },
  { name: 'Apfelschorle', icon: '🍎', preisCent: 150, kategorie: 'alkoholfrei' },
  { name: 'Bier', icon: '🍺', preisCent: 200, kategorie: 'alkoholisch' },
  { name: 'Radler', icon: '🍻', preisCent: 200, kategorie: 'alkoholisch' },
  { name: 'Kaffee', icon: '☕', preisCent: 100, kategorie: 'sonstiges' },
];

async function seedDrinks() {
  let added = 0;
  let kept = 0;
  for (const drink of DRINK_SEEDS) {
    const existing = await prisma.drink.findFirst({ where: { name: drink.name } });
    if (existing) {
      kept++;
      continue;
    }
    await prisma.drink.create({ data: drink });
    added++;
  }
  console.log(`🍺 Drinks: ${added} neu, ${kept} schon vorhanden (${DRINK_SEEDS.length} Soll, Kategorien: ${DRINK_KATEGORIEN.join('/')}).`);
}

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
    await prisma.invite.create({
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

  await seedDrinks();
}

main()
  .catch((err) => {
    console.error('Seed-Fehler:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
