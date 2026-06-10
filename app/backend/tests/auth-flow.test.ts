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

// In dieselbe Datei integriert (statt eigenes Test-File), weil vitest mit
// singleFork+isolate eine geteilte process.env hat — zwei Files würden den
// DATABASE_URL-Race triggern. Wenn die Test-Suite wächst, lohnt globalSetup.
describe('Admin-Drink-CRUD', () => {
  // Member zum 403-Test: zweiten User anlegen + via Invite einloggen
  const memberAgent = supertest.agent(app);
  let memberToken: string;

  it('Member-Setup: zweiten User via Invite einloggen', async () => {
    const member = await prisma.user.create({
      data: { email: 'max@example.com', firstName: 'Max', lastName: 'Mustermann', isAdmin: false },
    });
    const inv = generateInviteToken();
    await prisma.invite.create({
      data: { tokenHash: inv.hash, userId: member.id, expiresAt: inviteExpiry() },
    });
    memberToken = inv.clear;
    const r = await memberAgent
      .post('/auth/invite-redeem')
      .send({ token: memberToken, password: 'Anderes-Pferd-Akku-7' });
    expect(r.status).toBe(200);
    expect(r.body.user.isAdmin).toBe(false);
  });

  it('lehnt nicht-eingeloggten Zugriff ab', async () => {
    const anon = supertest.agent(app);
    const r = await anon.get('/admin/drinks');
    expect(r.status).toBe(401);
  });

  it('lehnt Nicht-Admin-Zugriff ab', async () => {
    const r = await memberAgent.get('/admin/drinks');
    expect(r.status).toBe(403);
  });

  it('liefert leere Liste vor erstem Anlegen', async () => {
    const r = await agent.get('/admin/drinks');
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ drinks: [] });
  });

  it('legt Drink mit allen Feldern an', async () => {
    const r = await agent.post('/admin/drinks').send({
      name: 'Cola',
      preisCent: 150,
      icon: '🥤',
      kategorie: 'alkoholfrei',
    });
    expect(r.status).toBe(201);
    expect(r.body.drink).toMatchObject({
      name: 'Cola',
      preisCent: 150,
      icon: '🥤',
      kategorie: 'alkoholfrei',
      isActive: true,
    });
    expect(r.body.drink.id).toBeTruthy();
  });

  it('legt Drink ohne Icon an (Icon optional)', async () => {
    const r = await agent.post('/admin/drinks').send({
      name: 'Wasser',
      preisCent: 100,
      kategorie: 'alkoholfrei',
    });
    expect(r.status).toBe(201);
    expect(r.body.drink.icon).toBeNull();
  });

  it('weist negativen Preis zurück', async () => {
    const r = await agent.post('/admin/drinks').send({
      name: 'Negativ',
      preisCent: -50,
      kategorie: 'sonstiges',
    });
    expect(r.status).toBe(400);
  });

  it('weist nicht-ganzzahligen Preis zurück', async () => {
    const r = await agent.post('/admin/drinks').send({
      name: 'Bruch',
      preisCent: 1.5,
      kategorie: 'sonstiges',
    });
    expect(r.status).toBe(400);
  });

  it('weist leeren Namen zurück', async () => {
    const r = await agent.post('/admin/drinks').send({
      name: '   ',
      preisCent: 100,
      kategorie: 'alkoholfrei',
    });
    expect(r.status).toBe(400);
  });

  it('weist unbekannte Kategorie zurück', async () => {
    const r = await agent.post('/admin/drinks').send({
      name: 'Tee',
      preisCent: 100,
      kategorie: 'heissgetraenk',
    });
    expect(r.status).toBe(400);
  });

  it('listet alle Drinks sortiert nach Kategorie+Name', async () => {
    await agent.post('/admin/drinks').send({
      name: 'Bier',
      preisCent: 200,
      icon: '🍺',
      kategorie: 'alkoholisch',
    });
    const r = await agent.get('/admin/drinks');
    expect(r.status).toBe(200);
    expect(r.body.drinks.map((d: { name: string }) => d.name)).toEqual([
      'Cola',
      'Wasser',
      'Bier',
    ]);
  });

  it('aktualisiert Preis eines bestehenden Drinks', async () => {
    const list = await agent.get('/admin/drinks');
    const cola = list.body.drinks.find((d: { name: string }) => d.name === 'Cola');
    const r = await agent.patch(`/admin/drinks/${cola.id}`).send({ preisCent: 170 });
    expect(r.status).toBe(200);
    expect(r.body.drink.preisCent).toBe(170);
    expect(r.body.drink.name).toBe('Cola');
  });

  it('lehnt leeren Patch-Body ab', async () => {
    const list = await agent.get('/admin/drinks');
    const cola = list.body.drinks.find((d: { name: string }) => d.name === 'Cola');
    const r = await agent.patch(`/admin/drinks/${cola.id}`).send({});
    expect(r.status).toBe(400);
  });

  it('löscht Icon, wenn leerer String gesetzt wird', async () => {
    const list = await agent.get('/admin/drinks');
    const cola = list.body.drinks.find((d: { name: string }) => d.name === 'Cola');
    const r = await agent.patch(`/admin/drinks/${cola.id}`).send({ icon: '' });
    expect(r.status).toBe(200);
    expect(r.body.drink.icon).toBeNull();
  });

  it('antwortet 404 auf Patch unbekannter ID', async () => {
    const r = await agent.patch('/admin/drinks/does-not-exist').send({ preisCent: 100 });
    expect(r.status).toBe(404);
  });

  it('deaktiviert Drink (Soft-Disable)', async () => {
    const list = await agent.get('/admin/drinks');
    const bier = list.body.drinks.find((d: { name: string }) => d.name === 'Bier');
    const r = await agent.patch(`/admin/drinks/${bier.id}/active`).send({ isActive: false });
    expect(r.status).toBe(200);
    expect(r.body.drink.isActive).toBe(false);
  });

  it('listet inaktive Drinks weiterhin im Admin-Endpoint', async () => {
    const r = await agent.get('/admin/drinks');
    const bier = r.body.drinks.find((d: { name: string }) => d.name === 'Bier');
    expect(bier).toBeDefined();
    expect(bier.isActive).toBe(false);
  });

  it('reaktiviert Drink', async () => {
    const list = await agent.get('/admin/drinks');
    const bier = list.body.drinks.find((d: { name: string }) => d.name === 'Bier');
    const r = await agent.patch(`/admin/drinks/${bier.id}/active`).send({ isActive: true });
    expect(r.status).toBe(200);
    expect(r.body.drink.isActive).toBe(true);
  });

  it('weist Active-Patch mit unpassendem Typ ab', async () => {
    const list = await agent.get('/admin/drinks');
    const cola = list.body.drinks.find((d: { name: string }) => d.name === 'Cola');
    const r = await agent.patch(`/admin/drinks/${cola.id}/active`).send({ isActive: 'ja' });
    expect(r.status).toBe(400);
  });
});
