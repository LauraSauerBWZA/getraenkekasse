import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

// Eigene Test-DB pro Run, damit der Test keinen prod-Datenbestand berührt
const tmpDir = mkdtempSync(join(tmpdir(), 'bwza-test-'));
const dbFile = join(tmpDir, 'test.db');

process.env.DATABASE_URL = `file:${dbFile}`;
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-1234';
process.env.NODE_ENV = 'test';
process.env.FRONTEND_ORIGIN = 'http://localhost:3001';
process.env.APP_BASE_URL = 'http://localhost:3001';

const here = dirname(fileURLToPath(import.meta.url));
const backendRoot = join(here, '..');

// prisma db push gegen die Test-DB
execFileSync(
  'npx',
  ['prisma', 'db', 'push', '--skip-generate', '--accept-data-loss'],
  { cwd: backendRoot, stdio: 'inherit', env: process.env as NodeJS.ProcessEnv },
);

// Erst nach gesetzten ENVs importieren — sonst greift die Validierung den Default
const { buildApp } = await import('../src/index.js');
const { prisma } = await import('../src/db.js');
const { generateInviteToken, inviteExpiry } = await import('../src/auth/tokens.js');
const supertest = (await import('supertest')).default;

const app = buildApp();
const agent = supertest.agent(app);

beforeAll(async () => {
  // Admin Laura + Magic-Link einseeden
  const admin = await prisma.user.create({
    data: { email: 'laura_sauer@gmx.de', firstName: 'Laura', lastName: 'Sauer', isAdmin: true },
  });
  const { clear, hash } = generateInviteToken();
  await prisma.invite.create({
    data: { tokenHash: hash, userId: admin.id, expiresAt: inviteExpiry() },
  });
  // Klartext-Token an die Test-Suite weiterreichen
  (globalThis as any).__SEED_TOKEN__ = clear;
});

afterAll(async () => {
  await prisma.$disconnect();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('Auth-Happy-Path', () => {
  it('Health-Check antwortet ok', async () => {
    const r = await agent.get('/health');
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ status: 'ok' });
  });

  it('löst den Magic-Link ein, setzt Passwort und öffnet eine Session', async () => {
    const token = (globalThis as any).__SEED_TOKEN__ as string;
    const r = await agent
      .post('/auth/invite-redeem')
      .send({ token, password: 'Korrektes-Pferd-Akku-7' });

    expect(r.status).toBe(200);
    expect(r.body.user.email).toBe('laura_sauer@gmx.de');
    expect(r.body.user.firstName).toBe('Laura');
    expect(r.body.user.isAdmin).toBe(true);
    // HTTP-Only-Cookie wurde gesetzt
    expect(r.headers['set-cookie']?.join(';')).toMatch(/bwza_session=/);
  });

  it('blockt den schon eingelösten Magic-Link bei zweiter Verwendung', async () => {
    const token = (globalThis as any).__SEED_TOKEN__ as string;
    // Frischer Agent, weil die alte Session noch aktiv ist
    const fresh = supertest.agent(app);
    const r = await fresh
      .post('/auth/invite-redeem')
      .send({ token, password: 'Anderes-Passwort-1!' });
    expect(r.status).toBe(400);
  });

  it('liefert /auth/me mit JWT-Cookie aus invite-redeem', async () => {
    const r = await agent.get('/auth/me');
    expect(r.status).toBe(200);
    expect(r.body.user.email).toBe('laura_sauer@gmx.de');
    expect(r.body.user.guthabenCent).toBe(0);
  });

  it('akzeptiert anschließend Login mit dem gesetzten Passwort', async () => {
    const fresh = supertest.agent(app);
    const r = await fresh
      .post('/auth/login')
      .send({ email: 'laura_sauer@gmx.de', password: 'Korrektes-Pferd-Akku-7' });
    expect(r.status).toBe(200);
    expect(r.body.user.isAdmin).toBe(true);

    const me = await fresh.get('/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('laura_sauer@gmx.de');
  });

  it('lehnt /auth/me ohne Cookie ab', async () => {
    const anon = supertest.agent(app);
    const r = await anon.get('/auth/me');
    expect(r.status).toBe(401);
  });
});
