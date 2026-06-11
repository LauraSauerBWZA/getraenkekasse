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
// Member-Agent (Max Mustermann) wird im Admin-Drink-CRUD-Block via Invite
// eingeloggt und im Buchungs-Flow-Block weiterverwendet — daher Modul-Scope.
const memberAgent = supertest.agent(app);
let memberToken: string;

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
  // memberAgent + memberToken sind im Modul-Scope deklariert (oben), damit
  // der Buchungs-Flow-Block sie weiterverwenden kann.

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

// Buchungs-Flow läuft als Member (memberAgent ist seit dem Admin-CRUD-Setup
// als Max Mustermann eingeloggt). Die Tests setzen oben gebaute Drinks voraus
// (Cola/Wasser aktiv, Bier wurde im Active-Patch zurück auf aktiv gesetzt).
describe('Buchungs-Flow', () => {
  let colaId: string;
  let bierId: string;

  it('lehnt Drink-Listing ohne Login ab', async () => {
    const anon = supertest.agent(app);
    const r = await anon.get('/drinks');
    expect(r.status).toBe(401);
  });

  it('liefert für Mitglieder nur aktive Drinks (Member-Endpoint, kein Admin-Gate)', async () => {
    // Cola deaktivieren, dann sicherstellen, dass sie verschwindet
    const listAll = await agent.get('/admin/drinks');
    const cola = listAll.body.drinks.find((d: { name: string }) => d.name === 'Cola');
    colaId = cola.id;
    bierId = listAll.body.drinks.find((d: { name: string }) => d.name === 'Bier').id;
    await agent.patch(`/admin/drinks/${colaId}/active`).send({ isActive: false });

    const r = await memberAgent.get('/drinks');
    expect(r.status).toBe(200);
    const names = r.body.drinks.map((d: { name: string }) => d.name);
    expect(names).not.toContain('Cola');
    expect(names).toContain('Wasser');
    expect(names).toContain('Bier');

    // Cola wieder aktivieren für die folgenden Tests
    await agent.patch(`/admin/drinks/${colaId}/active`).send({ isActive: true });
  });

  it('lehnt Buchung ohne Login ab', async () => {
    const anon = supertest.agent(app);
    const r = await anon.post('/transaktionen/kauf').send({ drinkId: colaId });
    expect(r.status).toBe(401);
  });

  it('lehnt Buchung mit unbekanntem Drink ab', async () => {
    const r = await memberAgent.post('/transaktionen/kauf').send({ drinkId: 'gibts-nicht' });
    expect(r.status).toBe(404);
  });

  it('lehnt Buchung eines inaktiven Drinks ab', async () => {
    await agent.patch(`/admin/drinks/${colaId}/active`).send({ isActive: false });
    const r = await memberAgent.post('/transaktionen/kauf').send({ drinkId: colaId });
    expect(r.status).toBe(400);
    await agent.patch(`/admin/drinks/${colaId}/active`).send({ isActive: true });
  });

  it('lehnt Buchung mit fehlendem drinkId ab', async () => {
    const r = await memberAgent.post('/transaktionen/kauf').send({});
    expect(r.status).toBe(400);
  });

  it('bucht Cola: Transaktion mit eingefrorenem Preis + neues Guthaben', async () => {
    // Cola-Preis vorher: 170 (durch Admin-Patch oben), aber wir setzen sicherheitshalber
    await agent.patch(`/admin/drinks/${colaId}`).send({ preisCent: 150 });

    const r = await memberAgent.post('/transaktionen/kauf').send({ drinkId: colaId });
    expect(r.status).toBe(201);
    expect(r.body.transaktion).toMatchObject({
      typ: 'KAUF',
      drinkId: colaId,
      preisAtKaufCent: 150,
      betragCent: -150,
    });
    expect(r.body.transaktion.userId).toBeTruthy();
    expect(r.body.transaktion.erstelltVonId).toBe(r.body.transaktion.userId);
    expect(r.body.guthabenCent).toBe(-150);
  });

  it('friert den Preis ein — Drink-Preisänderung beeinflusst Bestandsbuchung nicht', async () => {
    // Buchung gerade mit preisAtKaufCent=150. Jetzt Drink-Preis auf 999 ändern.
    await agent.patch(`/admin/drinks/${colaId}`).send({ preisCent: 999 });

    // Bestehende Transaktion muss weiterhin preisAtKaufCent=150 haben
    const tx = await prisma.transaktion.findFirst({
      where: { drinkId: colaId, typ: 'KAUF' },
      orderBy: { createdAt: 'asc' },
    });
    expect(tx?.preisAtKaufCent).toBe(150);
    expect(tx?.betragCent).toBe(-150);
  });

  it('summiert mehrere Buchungen korrekt zum Live-Guthaben', async () => {
    // Aktueller Stand: -150 von der Cola-Buchung. Bier (200) buchen → -350.
    const r1 = await memberAgent.post('/transaktionen/kauf').send({ drinkId: bierId });
    expect(r1.status).toBe(201);
    expect(r1.body.guthabenCent).toBe(-350);

    // Noch ein Bier → -550
    const r2 = await memberAgent.post('/transaktionen/kauf').send({ drinkId: bierId });
    expect(r2.status).toBe(201);
    expect(r2.body.guthabenCent).toBe(-550);

    // /auth/me liefert dasselbe Guthaben (Konsistenz Live-Summe)
    const me = await memberAgent.get('/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.guthabenCent).toBe(-550);
  });

  it('Admin-Guthaben bleibt 0 (eigene Buchungen unabhängig)', async () => {
    const me = await agent.get('/auth/me');
    expect(me.body.user.guthabenCent).toBe(0);
  });
});

// Knüpft am Buchungs-Flow-Block an: memberAgent (Max) hat aus den vorigen Tests
// drei KAUF-Transaktionen (Cola 150 + 2× Bier à 200 = -550) und Live-Guthaben -550.
describe('Storno-Flow', () => {
  // Helper: aktuelle Transaktionen von Max in chronologischer Reihenfolge.
  // Wir greifen direkt auf Prisma zu, weil es noch keinen Verlauf-Endpoint gibt.
  async function maxTxs() {
    const me = await memberAgent.get('/auth/me');
    return prisma.transaktion.findMany({
      where: { userId: me.body.user.id },
      orderBy: { createdAt: 'asc' },
    });
  }

  it('lehnt Storno ohne Login ab', async () => {
    const anon = supertest.agent(app);
    const txs = await maxTxs();
    const r = await anon.post(`/transaktionen/${txs[0].id}/storno`).send({});
    expect(r.status).toBe(401);
  });

  it('liefert 404 bei unbekannter Transaktions-ID', async () => {
    const r = await memberAgent.post('/transaktionen/gibts-nicht/storno').send({});
    expect(r.status).toBe(404);
  });

  it('Mitglied storniert eigene KAUF im Fenster — Auto-Notiz + Guthaben zurück', async () => {
    const txs = await maxTxs();
    // Letzte Bier-Buchung (zweites Bier, betragCent=-200) → -550 → -350 nach Storno
    const letztesBier = txs.filter((t) => t.typ === 'KAUF' && t.betragCent === -200).at(-1)!;
    const r = await memberAgent.post(`/transaktionen/${letztesBier.id}/storno`).send({});
    expect(r.status).toBe(201);
    expect(r.body.transaktion).toMatchObject({
      typ: 'STORNO',
      stornoVonId: letztesBier.id,
      betragCent: 200,
      userId: letztesBier.userId,
      erstelltVonId: letztesBier.userId,
    });
    expect(r.body.transaktion.notiz).toMatch(/5-min/i);
    expect(r.body.guthabenCent).toBe(-350);
  });

  it('lehnt Doppel-Storno auf bereits stornierte Transaktion ab', async () => {
    const txs = await maxTxs();
    const stornierteId = txs.find((t) => t.typ === 'STORNO')!.stornoVonId!;
    const r = await memberAgent.post(`/transaktionen/${stornierteId}/storno`).send({});
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/bereits storniert/i);
  });

  it('lehnt Storno einer STORNO-Transaktion ab (keine Storno-Stornos)', async () => {
    const txs = await maxTxs();
    const stornoTx = txs.find((t) => t.typ === 'STORNO')!;
    const r = await memberAgent.post(`/transaktionen/${stornoTx.id}/storno`).send({});
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/storno-transaktion/i);
  });

  it('Mitglied: außerhalb des 5-Min-Fensters → 403', async () => {
    // erstes Bier (älter, betragCent=-200) künstlich auf createdAt vor 6 Min setzen
    const txs = await maxTxs();
    const erstesBier = txs.find((t) => t.typ === 'KAUF' && t.betragCent === -200)!;
    const vorSechsMin = new Date(Date.now() - 6 * 60 * 1000);
    await prisma.transaktion.update({
      where: { id: erstesBier.id },
      data: { createdAt: vorSechsMin },
    });

    const r = await memberAgent.post(`/transaktionen/${erstesBier.id}/storno`).send({});
    expect(r.status).toBe(403);
    expect(r.body.error).toMatch(/fenster/i);
  });

  it('Mitglied: fremde Transaktion → 403', async () => {
    // Admin (Laura) hat keine eigenen KAUF-Transaktionen. Wir geben ihr eine,
    // damit Max sie nicht stornieren darf.
    const adminMe = await agent.get('/auth/me');
    const fremdeTx = await prisma.transaktion.create({
      data: {
        typ: 'KAUF',
        userId: adminMe.body.user.id,
        erstelltVonId: adminMe.body.user.id,
        betragCent: -100,
        preisAtKaufCent: 100,
      },
    });

    const r = await memberAgent.post(`/transaktionen/${fremdeTx.id}/storno`).send({});
    expect(r.status).toBe(403);
    expect(r.body.error).toMatch(/fremde transaktion/i);
  });

  it('Admin storniert jederzeit — auch außerhalb des Fensters, andere Mitglieder', async () => {
    // erstes Bier (Max) ist seit dem 5-Min-Test auf createdAt -6 Min. Admin
    // storniert es trotzdem.
    const txs = await maxTxs();
    const erstesBier = txs.find(
      (t) => t.typ === 'KAUF' && t.betragCent === -200,
    )!;
    const r = await agent
      .post(`/transaktionen/${erstesBier.id}/storno`)
      .send({ notiz: 'Versehentliche Buchung, Korrektur durch Verwalter.' });
    expect(r.status).toBe(201);
    expect(r.body.transaktion).toMatchObject({
      typ: 'STORNO',
      stornoVonId: erstesBier.id,
      betragCent: 200,
      notiz: 'Versehentliche Buchung, Korrektur durch Verwalter.',
    });
    // erstelltVonId muss die Admin-ID sein, nicht der betroffene User
    const adminMe = await agent.get('/auth/me');
    expect(r.body.transaktion.erstelltVonId).toBe(adminMe.body.user.id);
    expect(r.body.transaktion.userId).toBe(erstesBier.userId);
    // Max-Guthaben jetzt -150 (war -350 nach erstem Mitglied-Storno, +200 vom Admin-Storno)
    expect(r.body.guthabenCent).toBe(-150);
  });

  it('Admin ohne Notiz → 400', async () => {
    // Cola-KAUF (-150) ist noch unstorniert — Admin probiert ohne Notiz
    const txs = await maxTxs();
    const cola = txs.find((t) => t.typ === 'KAUF' && t.betragCent === -150)!;
    const r = await agent.post(`/transaktionen/${cola.id}/storno`).send({});
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/notiz/i);
  });

  it('Admin mit Whitespace-only Notiz → 400', async () => {
    const txs = await maxTxs();
    const cola = txs.find((t) => t.typ === 'KAUF' && t.betragCent === -150)!;
    const r = await agent
      .post(`/transaktionen/${cola.id}/storno`)
      .send({ notiz: '   ' });
    expect(r.status).toBe(400);
  });

  it('Admin storniert EIGENE frische KAUF OHNE Notiz → 201 (Self-Storno-Pfad)', async () => {
    // Admin (Laura) kann auch selbst Drinks buchen (§4). Wenn sie eine frische
    // eigene KAUF im Fenster zurückrollt, gilt derselbe frictionless Undo wie
    // bei Mitgliedern — keine Notiz nötig, Auto-Notiz vom Backend.
    const adminMe = await agent.get('/auth/me');
    const eigeneTx = await prisma.transaktion.create({
      data: {
        typ: 'KAUF',
        userId: adminMe.body.user.id,
        erstelltVonId: adminMe.body.user.id,
        betragCent: -120,
        preisAtKaufCent: 120,
      },
    });

    const r = await agent.post(`/transaktionen/${eigeneTx.id}/storno`).send({});
    expect(r.status).toBe(201);
    expect(r.body.transaktion).toMatchObject({
      typ: 'STORNO',
      stornoVonId: eigeneTx.id,
      betragCent: 120,
      userId: adminMe.body.user.id,
      erstelltVonId: adminMe.body.user.id,
    });
    expect(r.body.transaktion.notiz).toMatch(/5-min/i);
    // Admin-Guthaben: hatten zwischenzeitlich -100 von „Mitglied: fremde Tx"
    // (preisAtKaufCent=100, betragCent=-100), dann -120 eigene + +120 Storno = -100
    expect(r.body.guthabenCent).toBe(-100);
  });

  it('Admin storniert FREMDE frische KAUF OHNE Notiz → weiterhin 400', async () => {
    // Gegenprobe: derselbe „ohne Notiz"-Call wie oben, aber auf eine fremde
    // KAUF — muss weiterhin scheitern, weil dann der Admin-Pflicht-Pfad greift.
    // Wir nutzen Max' noch unstornierte Cola.
    const txs = await maxTxs();
    const cola = txs.find((t) => t.typ === 'KAUF' && t.betragCent === -150)!;
    expect(cola.userId).not.toBe((await agent.get('/auth/me')).body.user.id);
    const r = await agent.post(`/transaktionen/${cola.id}/storno`).send({});
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/notiz/i);
  });

  it('Live-Guthaben nach allen Stornos konsistent mit /auth/me', async () => {
    const me = await memberAgent.get('/auth/me');
    expect(me.body.user.guthabenCent).toBe(-150);
  });
});
