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
const { berlinDayKey } = await import('../src/routes/journal.js');
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

// B2e.2 — Admin-Mitgliederliste für die Bargeld-Aufladung. Stand nach Storno-
// Flow-Block: Laura (Admin) mit Guthaben -100 (eine fremde Tx aus dem Storno-
// Test, die nicht zurückgerollt wurde), Max mit -150.
describe('Admin-Mitgliederliste', () => {
  it('lehnt Listing ohne Login ab', async () => {
    const anon = supertest.agent(app);
    const r = await anon.get('/admin/users');
    expect(r.status).toBe(401);
  });

  it('lehnt Listing ohne Admin-Recht ab', async () => {
    const r = await memberAgent.get('/admin/users');
    expect(r.status).toBe(403);
  });

  it('liefert aktive Mitglieder sortiert nach Vorname mit Live-Guthaben', async () => {
    const r = await agent.get('/admin/users');
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.users)).toBe(true);
    const namen = r.body.users.map((u: { firstName: string }) => u.firstName);
    expect(namen).toEqual([...namen].sort());
    // Laura + Max sind drin
    const laura = r.body.users.find((u: { email: string }) => u.email === 'laura_sauer@gmx.de');
    const max = r.body.users.find((u: { email: string }) => u.email === 'max@example.com');
    expect(laura).toBeDefined();
    expect(max).toBeDefined();
    expect(laura.isAdmin).toBe(true);
    expect(max.isAdmin).toBe(false);
    expect(laura.guthabenCent).toBe(-100);
    expect(max.guthabenCent).toBe(-150);
  });

  it('blendet deaktivierte User aus', async () => {
    // Test-User hinzufügen, deaktivieren, prüfen dass er fehlt
    const inactive = await prisma.user.create({
      data: {
        email: 'inactive@example.com',
        firstName: 'Inactive',
        lastName: 'User',
        isActive: false,
      },
    });
    const r = await agent.get('/admin/users');
    expect(r.body.users.find((u: { id: string }) => u.id === inactive.id)).toBeUndefined();
    await prisma.user.delete({ where: { id: inactive.id } });
  });
});

// B2e.3 — Bargeld-Aufladung. Voraussetzung: Max hat aktuell -150 (aus den
// vorigen Storno-Tests), Laura -100.
describe('Bargeld-Aufladung', () => {
  let maxId: string;
  let lauraId: string;

  it('Setup: User-IDs holen', async () => {
    const r = await agent.get('/admin/users');
    maxId = r.body.users.find((u: { email: string }) => u.email === 'max@example.com').id;
    lauraId = r.body.users.find((u: { email: string }) => u.email === 'laura_sauer@gmx.de').id;
    expect(maxId).toBeTruthy();
    expect(lauraId).toBeTruthy();
  });

  it('lehnt Aufladung ohne Login ab', async () => {
    const anon = supertest.agent(app);
    const r = await anon.post('/admin/aufladung/bargeld').send({
      userId: maxId,
      betragCent: 1000,
      vermerk: 'Test',
    });
    expect(r.status).toBe(401);
  });

  it('lehnt Aufladung ohne Admin-Recht ab', async () => {
    const r = await memberAgent.post('/admin/aufladung/bargeld').send({
      userId: maxId,
      betragCent: 1000,
      vermerk: 'Test',
    });
    expect(r.status).toBe(403);
  });

  it('lehnt fehlenden Vermerk ab', async () => {
    const r = await agent
      .post('/admin/aufladung/bargeld')
      .send({ userId: maxId, betragCent: 1000 });
    expect(r.status).toBe(400);
  });

  it('lehnt Whitespace-Vermerk ab', async () => {
    const r = await agent
      .post('/admin/aufladung/bargeld')
      .send({ userId: maxId, betragCent: 1000, vermerk: '   ' });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/vermerk/i);
  });

  it('lehnt nicht-positive Beträge ab', async () => {
    const r1 = await agent
      .post('/admin/aufladung/bargeld')
      .send({ userId: maxId, betragCent: 0, vermerk: 'Test' });
    expect(r1.status).toBe(400);
    const r2 = await agent
      .post('/admin/aufladung/bargeld')
      .send({ userId: maxId, betragCent: -100, vermerk: 'Test' });
    expect(r2.status).toBe(400);
  });

  it('lehnt nicht-ganzzahligen Betrag ab', async () => {
    const r = await agent
      .post('/admin/aufladung/bargeld')
      .send({ userId: maxId, betragCent: 12.34, vermerk: 'Test' });
    expect(r.status).toBe(400);
  });

  it('lehnt unbekannten User ab', async () => {
    const r = await agent
      .post('/admin/aufladung/bargeld')
      .send({ userId: 'gibts-nicht', betragCent: 1000, vermerk: 'Test' });
    expect(r.status).toBe(404);
  });

  it('lehnt deaktivierten User ab', async () => {
    const inactive = await prisma.user.create({
      data: {
        email: 'inactive2@example.com',
        firstName: 'Off',
        lastName: 'Line',
        isActive: false,
      },
    });
    const r = await agent
      .post('/admin/aufladung/bargeld')
      .send({ userId: inactive.id, betragCent: 1000, vermerk: 'Test' });
    expect(r.status).toBe(400);
    await prisma.user.delete({ where: { id: inactive.id } });
  });

  it('lädt Max 10,00 € auf und legt beide Zeilen atomar verknüpft an', async () => {
    // Max vor Aufladung: -150
    const r = await agent
      .post('/admin/aufladung/bargeld')
      .send({ userId: maxId, betragCent: 1000, vermerk: 'Bar gegeben am 11.06.' });
    expect(r.status).toBe(201);

    expect(r.body.transaktion).toMatchObject({
      typ: 'AUFLADUNG_BARGELD',
      userId: maxId,
      erstelltVonId: lauraId,
      betragCent: 1000,
      notiz: 'Bar gegeben am 11.06.',
    });
    expect(r.body.transaktion.kassenTransaktionId).toBeTruthy();

    expect(r.body.kassenTransaktion).toMatchObject({
      typ: 'EINZAHLUNG',
      konto: 'VERWALTER',
      verwalterId: lauraId,
      betragCent: 1000,
      notiz: 'Bar gegeben am 11.06.',
      erstelltVonId: lauraId,
    });
    expect(r.body.kassenTransaktion.transaktionId).toBe(r.body.transaktion.id);
    expect(r.body.transaktion.kassenTransaktionId).toBe(r.body.kassenTransaktion.id);

    // Max-Guthaben: -150 + 1000 = 850
    expect(r.body.guthabenCent).toBe(850);

    // DB-Konsistenz-Check über /auth/me
    const me = await memberAgent.get('/auth/me');
    expect(me.body.user.guthabenCent).toBe(850);
  });

  it('mehrere Aufladungen summieren sich korrekt', async () => {
    const r = await agent
      .post('/admin/aufladung/bargeld')
      .send({ userId: maxId, betragCent: 500, vermerk: 'Zweite Bar-Einzahlung' });
    expect(r.status).toBe(201);
    expect(r.body.guthabenCent).toBe(1350);
  });

  it('Atomarität: ungültiger User rollt nichts in der DB an', async () => {
    const kasseVor = await prisma.kassenTransaktion.count();
    const txVor = await prisma.transaktion.count();
    const r = await agent
      .post('/admin/aufladung/bargeld')
      .send({ userId: 'gibts-nicht', betragCent: 999, vermerk: 'Test' });
    expect(r.status).toBe(404);
    expect(await prisma.kassenTransaktion.count()).toBe(kasseVor);
    expect(await prisma.transaktion.count()).toBe(txVor);
  });
});

// B2e.4 — Aufladungs-Storno mit Kassen-Rückbuchung (§6.3). Stand nach B2e.3:
// Max hat zwei AUFLADUNG_BARGELD-Zeilen (+1000, +500), Live-Guthaben 1350.
// Lauras VERWALTER-Topf hat +1000 + +500 = +1500 von den beiden Einzahlungen.
describe('Aufladungs-Storno', () => {
  async function verwalterTopf(verwalterId: string): Promise<number> {
    const agg = await prisma.kassenTransaktion.aggregate({
      _sum: { betragCent: true },
      where: { konto: 'VERWALTER', verwalterId },
    });
    return agg._sum.betragCent ?? 0;
  }

  it('Admin storniert Bargeld-Aufladung → STORNO + Gegen-KORREKTUR atomar', async () => {
    const adminMe = await agent.get('/auth/me');
    const memberMe = await memberAgent.get('/auth/me');
    const lauraId = adminMe.body.user.id;
    const maxId = memberMe.body.user.id;

    const topfVor = await verwalterTopf(lauraId);
    const maxGuthabenVor = memberMe.body.user.guthabenCent;

    // Wir greifen die ERSTE Bargeld-Aufladung (+1000) und stornieren sie
    const aufladung = await prisma.transaktion.findFirst({
      where: { userId: maxId, typ: 'AUFLADUNG_BARGELD', betragCent: 1000 },
      orderBy: { createdAt: 'asc' },
    });
    expect(aufladung).toBeTruthy();
    expect(aufladung!.kassenTransaktionId).toBeTruthy();

    const r = await agent
      .post(`/transaktionen/${aufladung!.id}/storno`)
      .send({ notiz: 'Doppelt eingetragen, korrigiere.' });
    expect(r.status).toBe(201);

    // STORNO-Zeile auf Mitglieder-Seite
    expect(r.body.transaktion).toMatchObject({
      typ: 'STORNO',
      stornoVonId: aufladung!.id,
      userId: maxId,
      betragCent: -1000,
      notiz: 'Doppelt eingetragen, korrigiere.',
      erstelltVonId: lauraId,
    });

    // Gegen-KORREKTUR-Zeile auf Kassen-Seite
    expect(r.body.kassenGegenbuchung).toMatchObject({
      typ: 'KORREKTUR',
      konto: 'VERWALTER',
      verwalterId: lauraId,
      betragCent: -1000,
      erstelltVonId: lauraId,
    });
    expect(r.body.kassenGegenbuchung.notiz).toMatch(/storno-rückbuchung/i);

    // Mitglied-Guthaben zurück
    expect(r.body.guthabenCent).toBe(maxGuthabenVor - 1000);

    // Verwalter-Topf zurück
    expect(await verwalterTopf(lauraId)).toBe(topfVor - 1000);
  });

  it('Mitglied: Selbst-Undo greift nur bei KAUF — Aufladung ohne Admin-Recht → 403', async () => {
    // Max versucht seine zweite Bargeld-Aufladung (+500) selbst zu stornieren.
    // Auch wenn sie userId=Max hat und im Fenster wäre: typ='AUFLADUNG_BARGELD'
    // greift NICHT in den Self-Storno-Pfad (der prüft typ='KAUF').
    const memberMe = await memberAgent.get('/auth/me');
    const aufladung = await prisma.transaktion.findFirst({
      where: {
        userId: memberMe.body.user.id,
        typ: 'AUFLADUNG_BARGELD',
        betragCent: 500,
      },
    });
    expect(aufladung).toBeTruthy();
    const r = await memberAgent.post(`/transaktionen/${aufladung!.id}/storno`).send({});
    expect(r.status).toBe(403);
    expect(r.body.error).toMatch(/eigene käufe/i);
  });

  it('Admin storniert die zweite Bargeld-Aufladung mit Kassen-Gegenbuchung', async () => {
    const adminMe = await agent.get('/auth/me');
    const memberMe = await memberAgent.get('/auth/me');
    const lauraId = adminMe.body.user.id;
    const maxId = memberMe.body.user.id;

    const topfVor = await verwalterTopf(lauraId);
    const aufladung = await prisma.transaktion.findFirst({
      where: { userId: maxId, typ: 'AUFLADUNG_BARGELD', betragCent: 500 },
    });
    const r = await agent
      .post(`/transaktionen/${aufladung!.id}/storno`)
      .send({ notiz: 'Auch falsch eingetragen.' });
    expect(r.status).toBe(201);
    expect(r.body.kassenGegenbuchung).toMatchObject({
      typ: 'KORREKTUR',
      verwalterId: lauraId,
      betragCent: -500,
    });
    expect(await verwalterTopf(lauraId)).toBe(topfVor - 500);
    // Max wieder auf -150 (Stand vor allen Bargeld-Aufladungen)
    expect(r.body.guthabenCent).toBe(-150);
  });

  it('KAUF-Storno legt KEINE Kassen-Gegenbuchung an', async () => {
    // Eine neue eigene Cola-Buchung von Laura im Fenster, sofort selbst-undo
    const adminMe = await agent.get('/auth/me');
    const eigeneCola = await prisma.transaktion.create({
      data: {
        typ: 'KAUF',
        userId: adminMe.body.user.id,
        erstelltVonId: adminMe.body.user.id,
        betragCent: -150,
        preisAtKaufCent: 150,
      },
    });
    const kasseVor = await prisma.kassenTransaktion.count();
    const r = await agent.post(`/transaktionen/${eigeneCola.id}/storno`).send({});
    expect(r.status).toBe(201);
    expect(r.body.kassenGegenbuchung).toBeNull();
    expect(await prisma.kassenTransaktion.count()).toBe(kasseVor);
  });

  it('lehnt Doppel-Storno einer Aufladung weiter ab', async () => {
    // Die erste Aufladung wurde im ersten Test storniert
    const memberMe = await memberAgent.get('/auth/me');
    const aufladung = await prisma.transaktion.findFirst({
      where: {
        userId: memberMe.body.user.id,
        typ: 'AUFLADUNG_BARGELD',
        betragCent: 1000,
      },
    });
    const r = await agent
      .post(`/transaktionen/${aufladung!.id}/storno`)
      .send({ notiz: 'Erneuter Versuch.' });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/bereits storniert/i);
  });
});

// B2f.2 — PayPal-Aufladungs-Anfrage stellen (Mitglied) + zuständiger-Verwalter-
// Link. Stand: ein einziger Admin (Laura) → zuständig ist immer Laura (Single-
// Verwalter-Fall, §6.9-Degeneration). Max ist als memberAgent eingeloggt.
describe('PayPal-Anfrage (Mitglied)', () => {
  let lauraId: string;
  let maxId: string;

  it('Setup: IDs holen + Lauras paypal.me-Link setzen', async () => {
    lauraId = (await agent.get('/auth/me')).body.user.id;
    maxId = (await memberAgent.get('/auth/me')).body.user.id;
    // Pflege-UI ist B2k — fürs Anzeigen hier direkt am User setzen.
    await prisma.user.update({ where: { id: lauraId }, data: { paypalMeLink: 'laura-test' } });
    expect(lauraId).toBeTruthy();
    expect(maxId).toBeTruthy();
  });

  it('lehnt zuständiger-Verwalter ohne Login ab', async () => {
    const anon = supertest.agent(app);
    const r = await anon.get('/aufladung/zustaendiger-verwalter');
    expect(r.status).toBe(401);
  });

  it('liefert den zuständigen Verwalter mit paypal.me-Link', async () => {
    const r = await memberAgent.get('/aufladung/zustaendiger-verwalter');
    expect(r.status).toBe(200);
    expect(r.body.verwalter).toMatchObject({
      id: lauraId,
      firstName: 'Laura',
      paypalMeLink: 'laura-test',
    });
    // keine sensiblen Felder
    expect(r.body.verwalter.passwordHash).toBeUndefined();
  });

  it('lehnt Anfrage ohne Login ab', async () => {
    const anon = supertest.agent(app);
    const r = await anon.post('/aufladung/paypal').send({ betragCent: 1000 });
    expect(r.status).toBe(401);
  });

  it('lehnt nicht-positive / nicht-ganzzahlige Beträge ab', async () => {
    for (const bad of [0, -500, 12.34]) {
      const r = await memberAgent.post('/aufladung/paypal').send({ betragCent: bad });
      expect(r.status).toBe(400);
    }
  });

  it('lehnt fehlenden Betrag ab', async () => {
    const r = await memberAgent.post('/aufladung/paypal').send({});
    expect(r.status).toBe(400);
  });

  it('legt eine offene Anfrage an, zugewiesen an den zuständigen Verwalter', async () => {
    const r = await memberAgent.post('/aufladung/paypal').send({ betragCent: 2000 });
    expect(r.status).toBe(201);
    expect(r.body.anfrage).toMatchObject({
      userId: maxId,
      betragCent: 2000,
      status: 'OFFEN',
      zugewiesenerVerwalterId: lauraId,
      decidedAt: null,
      decidedById: null,
      transaktionId: null,
    });
    expect(r.body.verwalter).toMatchObject({ id: lauraId, paypalMeLink: 'laura-test' });
    // Keine Buchung beim Stellen — Guthaben unverändert (Max steht bei -150).
    const me = await memberAgent.get('/auth/me');
    expect(me.body.user.guthabenCent).toBe(-150);
  });

  it('listet eigene Anfragen (neueste zuerst) inkl. Verwalter-Name', async () => {
    // Zweite Anfrage, damit Sortierung prüfbar ist.
    await memberAgent.post('/aufladung/paypal').send({ betragCent: 500 });
    const r = await memberAgent.get('/aufladung/meine');
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.anfragen)).toBe(true);
    expect(r.body.anfragen.length).toBeGreaterThanOrEqual(2);
    // neueste zuerst → die 500er-Anfrage ganz oben
    expect(r.body.anfragen[0].betragCent).toBe(500);
    expect(r.body.anfragen[0].zugewiesenerVerwalter).toMatchObject({
      id: lauraId,
      firstName: 'Laura',
    });
  });

  it('zeigt einem anderen Mitglied NICHT die fremden Anfragen', async () => {
    // Admin Laura hat selbst noch keine Anfrage gestellt.
    const r = await agent.get('/aufladung/meine');
    expect(r.status).toBe(200);
    expect(r.body.anfragen).toEqual([]);
  });
});

// B2f.3 — Admin bestätigt/lehnt PayPal-Anfragen. Stand aus B2f.2: Max hat zwei
// OFFENE Anfragen (2000 zuerst gestellt, dann 500), beide Laura zugewiesen.
// Max-Guthaben -150, Lauras Verwalter-Topf 0 (nach den B2e.4-Stornos).
describe('PayPal-Anfrage (Admin bestätigt/lehnt)', () => {
  let lauraId: string;
  let maxId: string;

  async function verwalterTopf(verwalterId: string): Promise<number> {
    const agg = await prisma.kassenTransaktion.aggregate({
      _sum: { betragCent: true },
      where: { konto: 'VERWALTER', verwalterId },
    });
    return agg._sum.betragCent ?? 0;
  }

  async function offeneAnfrage(betragCent: number) {
    return prisma.aufladungsAnfrage.findFirst({
      where: { betragCent, status: 'OFFEN' },
    });
  }

  it('Setup: IDs holen', async () => {
    lauraId = (await agent.get('/auth/me')).body.user.id;
    maxId = (await memberAgent.get('/auth/me')).body.user.id;
  });

  it('lehnt Anfragen-Liste ohne Login / ohne Admin ab', async () => {
    const anon = supertest.agent(app);
    expect((await anon.get('/admin/aufladung/anfragen')).status).toBe(401);
    expect((await memberAgent.get('/admin/aufladung/anfragen')).status).toBe(403);
  });

  it('liefert offene Anfragen mit Mitglied-Daten, älteste zuerst', async () => {
    const r = await agent.get('/admin/aufladung/anfragen');
    expect(r.status).toBe(200);
    const maxAnfragen = r.body.anfragen.filter(
      (a: { user: { id: string } }) => a.user.id === maxId,
    );
    expect(maxAnfragen.length).toBe(2);
    // älteste zuerst → 2000 (zuerst gestellt) vor 500
    expect(maxAnfragen[0].betragCent).toBe(2000);
    expect(maxAnfragen[1].betragCent).toBe(500);
    expect(maxAnfragen[0].user).toMatchObject({ firstName: 'Max', email: 'max@example.com' });
    expect(maxAnfragen[0].status).toBe('OFFEN');
  });

  it('lehnt Bestätigen ohne Admin-Recht ab', async () => {
    const anfrage = await offeneAnfrage(2000);
    const r = await memberAgent.post(`/admin/aufladung/anfragen/${anfrage!.id}/bestaetigen`).send({});
    expect(r.status).toBe(403);
  });

  it('antwortet 404 auf Bestätigen unbekannter Anfrage', async () => {
    const r = await agent.post('/admin/aufladung/anfragen/gibts-nicht/bestaetigen').send({});
    expect(r.status).toBe(404);
  });

  it('bestätigt die 2000er-Anfrage: gekoppelte Buchung, Guthaben + Topf steigen', async () => {
    const anfrage = await offeneAnfrage(2000);
    const topfVor = await verwalterTopf(lauraId);

    const r = await agent
      .post(`/admin/aufladung/anfragen/${anfrage!.id}/bestaetigen`)
      .send({ adminNotiz: 'PayPal am 14.06. erhalten' });
    expect(r.status).toBe(201);

    // Anfrage terminal + verlinkt
    expect(r.body.anfrage).toMatchObject({
      status: 'BESTAETIGT',
      decidedById: lauraId,
      adminNotiz: 'PayPal am 14.06. erhalten',
    });
    expect(r.body.anfrage.decidedAt).toBeTruthy();
    expect(r.body.anfrage.transaktionId).toBe(r.body.transaktion.id);

    // Mitglieder-Transaktion
    expect(r.body.transaktion).toMatchObject({
      typ: 'AUFLADUNG_PAYPAL',
      userId: maxId,
      erstelltVonId: lauraId,
      betragCent: 2000,
    });
    expect(r.body.transaktion.kassenTransaktionId).toBe(r.body.kassenTransaktion.id);

    // Kassen-EINZAHLUNG auf den zugewiesenen Verwalter-Topf
    expect(r.body.kassenTransaktion).toMatchObject({
      typ: 'EINZAHLUNG',
      konto: 'VERWALTER',
      verwalterId: lauraId,
      betragCent: 2000,
      erstelltVonId: lauraId,
    });

    // Max-Guthaben -150 → 1850, Lauras Topf +2000
    expect(r.body.guthabenCent).toBe(1850);
    const me = await memberAgent.get('/auth/me');
    expect(me.body.user.guthabenCent).toBe(1850);
    expect(await verwalterTopf(lauraId)).toBe(topfVor + 2000);
  });

  it('verhindert doppelte Entscheidung (schon bestätigte Anfrage)', async () => {
    const bestaetigt = await prisma.aufladungsAnfrage.findFirst({
      where: { betragCent: 2000, status: 'BESTAETIGT' },
    });
    const r = await agent
      .post(`/admin/aufladung/anfragen/${bestaetigt!.id}/bestaetigen`)
      .send({});
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/bereits entschieden/i);
  });

  it('lehnt die 500er-Anfrage ab: kein Booking, Status ABGELEHNT', async () => {
    const anfrage = await offeneAnfrage(500);
    const kasseVor = await prisma.kassenTransaktion.count();
    const guthabenVor = (await memberAgent.get('/auth/me')).body.user.guthabenCent;

    const r = await agent
      .post(`/admin/aufladung/anfragen/${anfrage!.id}/ablehnen`)
      .send({ adminNotiz: 'Keine Zahlung eingegangen' });
    expect(r.status).toBe(200);
    expect(r.body.anfrage).toMatchObject({
      status: 'ABGELEHNT',
      decidedById: lauraId,
      adminNotiz: 'Keine Zahlung eingegangen',
      transaktionId: null,
    });

    // keine Buchung
    expect(await prisma.kassenTransaktion.count()).toBe(kasseVor);
    const me = await memberAgent.get('/auth/me');
    expect(me.body.user.guthabenCent).toBe(guthabenVor);
  });

  it('verhindert Ablehnen einer schon entschiedenen Anfrage', async () => {
    const abgelehnt = await prisma.aufladungsAnfrage.findFirst({
      where: { betragCent: 500, status: 'ABGELEHNT' },
    });
    const r = await agent
      .post(`/admin/aufladung/anfragen/${abgelehnt!.id}/ablehnen`)
      .send({});
    expect(r.status).toBe(400);
  });

  it('nach Entscheidung sind keine offenen Anfragen von Max mehr in der Liste', async () => {
    const r = await agent.get('/admin/aufladung/anfragen');
    const maxOffen = r.body.anfragen.filter((a: { user: { id: string } }) => a.user.id === maxId);
    expect(maxOffen).toEqual([]);
  });

  // Verifiziert die generische B2e.4-Storno-Rückbuchung für AUFLADUNG_PAYPAL.
  it('Storno der bestätigten PayPal-Aufladung bucht die Kassen-Einzahlung zurück', async () => {
    const topfVor = await verwalterTopf(lauraId);
    const guthabenVor = (await memberAgent.get('/auth/me')).body.user.guthabenCent;

    // Die bei der Bestätigung erzeugte AUFLADUNG_PAYPAL-Transaktion (+2000)
    const paypalTx = await prisma.transaktion.findFirst({
      where: { userId: maxId, typ: 'AUFLADUNG_PAYPAL', betragCent: 2000 },
    });
    expect(paypalTx).toBeTruthy();
    expect(paypalTx!.kassenTransaktionId).toBeTruthy();

    const r = await agent
      .post(`/transaktionen/${paypalTx!.id}/storno`)
      .send({ notiz: 'PayPal-Zahlung zurückgezogen.' });
    expect(r.status).toBe(201);

    expect(r.body.transaktion).toMatchObject({
      typ: 'STORNO',
      stornoVonId: paypalTx!.id,
      betragCent: -2000,
      erstelltVonId: lauraId,
    });
    // Gegen-KORREKTUR auf demselben Verwalter-Topf
    expect(r.body.kassenGegenbuchung).toMatchObject({
      typ: 'KORREKTUR',
      konto: 'VERWALTER',
      verwalterId: lauraId,
      betragCent: -2000,
    });
    expect(r.body.kassenGegenbuchung.notiz).toMatch(/storno-rückbuchung/i);

    // Guthaben + Topf wieder zurück
    expect(r.body.guthabenCent).toBe(guthabenVor - 2000);
    expect(await verwalterTopf(lauraId)).toBe(topfVor - 2000);
  });
});

// B2g.1 — Mitglied-Detail (Stammdaten + Live-Saldo + Historie + stornierbar).
// Stand nach allen vorigen Blöcken: Max-Guthaben -150, mit reicher Historie
// (KAUF/STORNO/AUFLADUNG_BARGELD/AUFLADUNG_PAYPAL, teils storniert).
describe('Mitglied-Detail (Admin)', () => {
  let maxId: string;

  it('Setup: Max-Id', async () => {
    maxId = (await memberAgent.get('/auth/me')).body.user.id;
  });

  it('lehnt Detail ohne Login / ohne Admin ab', async () => {
    const anon = supertest.agent(app);
    expect((await anon.get(`/admin/users/${maxId}`)).status).toBe(401);
    expect((await memberAgent.get(`/admin/users/${maxId}`)).status).toBe(403);
  });

  it('antwortet 404 bei unbekannter ID', async () => {
    const r = await agent.get('/admin/users/gibts-nicht');
    expect(r.status).toBe(404);
  });

  it('liefert Stammdaten + Live-Saldo + Historie (jüngste zuerst)', async () => {
    const r = await agent.get(`/admin/users/${maxId}`);
    expect(r.status).toBe(200);
    expect(r.body.user).toMatchObject({
      id: maxId,
      email: 'max@example.com',
      firstName: 'Max',
      isAdmin: false,
      guthabenCent: -150,
    });
    expect(Array.isArray(r.body.transaktionen)).toBe(true);
    expect(r.body.transaktionen.length).toBeGreaterThan(0);

    // createdAt absteigend sortiert
    const zeiten = r.body.transaktionen.map((t: { createdAt: string }) =>
      new Date(t.createdAt).getTime(),
    );
    const sortiert = [...zeiten].sort((a, b) => b - a);
    expect(zeiten).toEqual(sortiert);
  });

  it('markiert eine stornierte Aufladung als storniert + nicht stornierbar', async () => {
    const r = await agent.get(`/admin/users/${maxId}`);
    const paypal = r.body.transaktionen.find(
      (t: { typ: string; betragCent: number }) =>
        t.typ === 'AUFLADUNG_PAYPAL' && t.betragCent === 2000,
    );
    expect(paypal).toBeTruthy();
    expect(paypal.storniert).toBe(true);
    expect(paypal.stornierbar).toBe(false);
  });

  it('eine STORNO-Zeile ist selbst nicht stornierbar', async () => {
    const r = await agent.get(`/admin/users/${maxId}`);
    const storno = r.body.transaktionen.find((t: { typ: string }) => t.typ === 'STORNO');
    expect(storno).toBeTruthy();
    expect(storno.stornierbar).toBe(false);
  });

  it('liefert den Drink-Namen bei KAUF + bietet eine offene KAUF zum Stornieren', async () => {
    const r = await agent.get(`/admin/users/${maxId}`);
    const kaufMitDrink = r.body.transaktionen.find(
      (t: { typ: string; drinkName: string | null }) => t.typ === 'KAUF' && t.drinkName,
    );
    expect(kaufMitDrink).toBeTruthy();
    expect(typeof kaufMitDrink.drinkName).toBe('string');
    // mindestens eine noch nicht stornierte KAUF (z.B. Cola -150) ist stornierbar
    const offen = r.body.transaktionen.find(
      (t: { typ: string; stornierbar: boolean }) => t.typ === 'KAUF' && t.stornierbar,
    );
    expect(offen).toBeTruthy();
  });
});

// B2g.2 — Manuelle Guthaben-Korrektur (nur Mitglieder-Transaktion, keine Kasse).
// Stand: Max-Guthaben -150.
describe('Guthaben-Korrektur (Admin)', () => {
  let maxId: string;
  let lauraId: string;

  it('Setup: IDs', async () => {
    maxId = (await memberAgent.get('/auth/me')).body.user.id;
    lauraId = (await agent.get('/auth/me')).body.user.id;
  });

  it('lehnt Korrektur ohne Login / ohne Admin ab', async () => {
    const anon = supertest.agent(app);
    expect(
      (await anon.post('/admin/korrektur').send({ userId: maxId, betragCent: 100, notiz: 'x' }))
        .status,
    ).toBe(401);
    expect(
      (await memberAgent
        .post('/admin/korrektur')
        .send({ userId: maxId, betragCent: 100, notiz: 'x' })).status,
    ).toBe(403);
  });

  it('lehnt Betrag 0 ab', async () => {
    const r = await agent
      .post('/admin/korrektur')
      .send({ userId: maxId, betragCent: 0, notiz: 'Ausgleich' });
    expect(r.status).toBe(400);
  });

  it('lehnt nicht-ganzzahligen Betrag ab', async () => {
    const r = await agent
      .post('/admin/korrektur')
      .send({ userId: maxId, betragCent: 12.5, notiz: 'Ausgleich' });
    expect(r.status).toBe(400);
  });

  it('lehnt fehlende / leere Notiz ab', async () => {
    const r1 = await agent.post('/admin/korrektur').send({ userId: maxId, betragCent: 100 });
    expect(r1.status).toBe(400);
    const r2 = await agent
      .post('/admin/korrektur')
      .send({ userId: maxId, betragCent: 100, notiz: '   ' });
    expect(r2.status).toBe(400);
    expect(r2.body.error).toMatch(/notiz/i);
  });

  it('lehnt unbekanntes Mitglied ab', async () => {
    const r = await agent
      .post('/admin/korrektur')
      .send({ userId: 'gibts-nicht', betragCent: 100, notiz: 'x' });
    expect(r.status).toBe(404);
  });

  it('Korrektur nach oben: legt KORREKTUR an + erhöht den Live-Saldo', async () => {
    // Max -150 → +500 → 350
    const r = await agent
      .post('/admin/korrektur')
      .send({ userId: maxId, betragCent: 500, notiz: 'Kassensturz-Ausgleich' });
    expect(r.status).toBe(201);
    expect(r.body.transaktion).toMatchObject({
      typ: 'KORREKTUR',
      userId: maxId,
      erstelltVonId: lauraId,
      betragCent: 500,
      notiz: 'Kassensturz-Ausgleich',
    });
    expect(r.body.guthabenCent).toBe(350);
    const me = await memberAgent.get('/auth/me');
    expect(me.body.user.guthabenCent).toBe(350);
  });

  it('Korrektur nach unten: negativer Betrag senkt den Saldo', async () => {
    // 350 → -200 → 150
    const r = await agent
      .post('/admin/korrektur')
      .send({ userId: maxId, betragCent: -200, notiz: 'Doppelbuchung zurück' });
    expect(r.status).toBe(201);
    expect(r.body.transaktion.betragCent).toBe(-200);
    expect(r.body.guthabenCent).toBe(150);
  });

  it('erzeugt KEINE Kassen-Buchung', async () => {
    const kasseVor = await prisma.kassenTransaktion.count();
    const r = await agent
      .post('/admin/korrektur')
      .send({ userId: maxId, betragCent: 100, notiz: 'Test ohne Kasse' });
    expect(r.status).toBe(201);
    expect(await prisma.kassenTransaktion.count()).toBe(kasseVor);
  });

  it('die Korrektur taucht in der Detail-Historie auf', async () => {
    const r = await agent.get(`/admin/users/${maxId}`);
    const korrektur = r.body.transaktionen.find(
      (t: { typ: string; notiz: string | null }) =>
        t.typ === 'KORREKTUR' && t.notiz === 'Kassensturz-Ausgleich',
    );
    expect(korrektur).toBeTruthy();
    expect(korrektur.stornierbar).toBe(true);
  });
});

// B2i.1 — Kassen-Summary + Historie. Kennzahlen werden gegen direkte DB-
// Aggregate geprüft (robust gegenüber dem langen Shared-State der Suite, statt
// fragiler Hardcodes).
describe('Kassen-Summary + Historie (Admin)', () => {
  let lauraId: string;

  it('Setup: Laura-Id', async () => {
    lauraId = (await agent.get('/auth/me')).body.user.id;
  });

  it('lehnt Summary ohne Login / ohne Admin ab', async () => {
    const anon = supertest.agent(app);
    expect((await anon.get('/admin/kasse/summary')).status).toBe(401);
    expect((await memberAgent.get('/admin/kasse/summary')).status).toBe(403);
  });

  it('summary: Kennzahlen konsistent mit DB-Aggregaten', async () => {
    const r = await agent.get('/admin/kasse/summary');
    expect(r.status).toBe(200);

    const allKassen = await prisma.kassenTransaktion.aggregate({ _sum: { betragCent: true } });
    const boxAgg = await prisma.kassenTransaktion.aggregate({
      _sum: { betragCent: true },
      where: { konto: 'BOX' },
    });
    const mitg = await prisma.transaktion.aggregate({ _sum: { betragCent: true } });

    expect(r.body.vereinsvermoegenCent).toBe(allKassen._sum.betragCent ?? 0);
    expect(r.body.boxCent).toBe(boxAgg._sum.betragCent ?? 0);
    expect(r.body.mitgliederGuthabenSummeCent).toBe(mitg._sum.betragCent ?? 0);
    expect(r.body.deckungCent).toBe(
      r.body.vereinsvermoegenCent - r.body.mitgliederGuthabenSummeCent,
    );

    // Summe aller Töpfe + Box = Vereinsvermögen
    const topfSum = r.body.toepfe.reduce(
      (s: number, t: { betragCent: number }) => s + t.betragCent,
      0,
    );
    expect(topfSum + r.body.boxCent).toBe(r.body.vereinsvermoegenCent);

    // Laura ist als Topf gelistet, Wert = direktes Aggregat
    const lauraTopf = r.body.toepfe.find(
      (t: { verwalterId: string }) => t.verwalterId === lauraId,
    );
    expect(lauraTopf).toBeTruthy();
    expect(lauraTopf.firstName).toBe('Laura');
    const direct = await prisma.kassenTransaktion.aggregate({
      _sum: { betragCent: true },
      where: { konto: 'VERWALTER', verwalterId: lauraId },
    });
    expect(lauraTopf.betragCent).toBe(direct._sum.betragCent ?? 0);
  });

  it('historie: jüngste zuerst, Verwalter-Name bei VERWALTER-Buchungen', async () => {
    const r = await agent.get('/admin/kasse/historie');
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.buchungen)).toBe(true);

    const zeiten = r.body.buchungen.map((b: { createdAt: string }) =>
      new Date(b.createdAt).getTime(),
    );
    expect(zeiten).toEqual([...zeiten].sort((a: number, b: number) => b - a));

    const einzahlung = r.body.buchungen.find((b: { typ: string }) => b.typ === 'EINZAHLUNG');
    expect(einzahlung).toBeTruthy();
    expect(einzahlung.konto).toBe('VERWALTER');
    expect(einzahlung.verwalterName).toMatch(/Laura/);
  });
});

// B2i.2 — Kassen-Aktionen. Delta-basiert (Summary vor/nach), robust gegenüber
// dem Shared-State der Suite.
describe('Kassen-Aktionen (Admin)', () => {
  let lauraId: string;

  interface Summary {
    toepfe: { verwalterId: string; betragCent: number }[];
    boxCent: number;
    vereinsvermoegenCent: number;
    mitgliederGuthabenSummeCent: number;
    deckungCent: number;
  }
  async function summary(): Promise<Summary> {
    return (await agent.get('/admin/kasse/summary')).body;
  }
  function topf(s: Summary, id: string): number {
    return s.toepfe.find((t) => t.verwalterId === id)?.betragCent ?? 0;
  }

  it('Setup: Laura-Id', async () => {
    lauraId = (await agent.get('/auth/me')).body.user.id;
  });

  it('lehnt Buchung/Einlage ohne Login / ohne Admin ab', async () => {
    const anon = supertest.agent(app);
    const body = { typ: 'EINKAUF', konto: 'VERWALTER', betragCent: 100, vermerk: 'x' };
    expect((await anon.post('/admin/kasse/buchung').send(body)).status).toBe(401);
    expect((await memberAgent.post('/admin/kasse/buchung').send(body)).status).toBe(403);
    expect((await anon.post('/admin/kasse/einlage').send({ betragCent: 100, vermerk: 'x' })).status).toBe(401);
    expect(
      (await memberAgent.post('/admin/kasse/einlage').send({ betragCent: 100, vermerk: 'x' })).status,
    ).toBe(403);
  });

  it('lehnt fehlenden / leeren Vermerk ab', async () => {
    const r1 = await agent
      .post('/admin/kasse/buchung')
      .send({ typ: 'EINKAUF', konto: 'VERWALTER', betragCent: 100 });
    expect(r1.status).toBe(400);
    const r2 = await agent
      .post('/admin/kasse/buchung')
      .send({ typ: 'EINKAUF', konto: 'VERWALTER', betragCent: 100, vermerk: '  ' });
    expect(r2.status).toBe(400);
  });

  it('EINKAUF (eigener Topf): senkt Topf + Vereinsvermögen, Mitglieder-Summe gleich', async () => {
    const vor = await summary();
    const r = await agent
      .post('/admin/kasse/buchung')
      .send({ typ: 'EINKAUF', konto: 'VERWALTER', betragCent: 3000, vermerk: 'Getränkemarkt 14.06.' });
    expect(r.status).toBe(201);
    expect(r.body.kassenTransaktion).toMatchObject({
      typ: 'EINKAUF',
      konto: 'VERWALTER',
      verwalterId: lauraId,
      betragCent: -3000,
      notiz: 'Getränkemarkt 14.06.',
    });
    const nach = await summary();
    expect(topf(nach, lauraId)).toBe(topf(vor, lauraId) - 3000);
    // Einkauf aus dem eigenen Topf darf diesen negativ machen (= Verein schuldet
    // dem Verwalter). Das ersetzt die in Update 9 entfernte Privat-Vorstreck-
    // Abdeckung.
    expect(topf(nach, lauraId)).toBeLessThan(0);
    expect(nach.vereinsvermoegenCent).toBe(vor.vereinsvermoegenCent - 3000);
    expect(nach.mitgliederGuthabenSummeCent).toBe(vor.mitgliederGuthabenSummeCent);
    expect(nach.deckungCent).toBe(vor.deckungCent - 3000);
  });

  it('EINKAUF (aus Box): senkt Box + Vereinsvermögen, verwalterId null', async () => {
    const vor = await summary();
    const r = await agent
      .post('/admin/kasse/buchung')
      .send({ typ: 'EINKAUF', konto: 'BOX', betragCent: 500, vermerk: 'Kasten aus der Box' });
    expect(r.status).toBe(201);
    expect(r.body.kassenTransaktion.verwalterId).toBeNull();
    const nach = await summary();
    expect(nach.boxCent).toBe(vor.boxCent - 500);
    expect(nach.vereinsvermoegenCent).toBe(vor.vereinsvermoegenCent - 500);
  });

  it('ENTNAHME (vereinsfremd): senkt das gewählte Konto', async () => {
    const vor = await summary();
    const r = await agent
      .post('/admin/kasse/buchung')
      .send({ typ: 'ENTNAHME', konto: 'VERWALTER', betragCent: 800, vermerk: 'Waschstraße Einsatzfahrzeug' });
    expect(r.status).toBe(201);
    expect(r.body.kassenTransaktion.betragCent).toBe(-800);
    const nach = await summary();
    expect(topf(nach, lauraId)).toBe(topf(vor, lauraId) - 800);
  });

  it('lehnt einen unbekannten Kassen-Typ ab', async () => {
    // Nur die gelisteten Typen sind erlaubt (Zod-Enum). Ein in Update 9
    // gestrichener oder vertippter Typ fällt hier durch.
    const r = await agent
      .post('/admin/kasse/buchung')
      .send({ typ: 'GIBTS_NICHT', konto: 'VERWALTER', betragCent: 1200, vermerk: 'x' });
    expect(r.status).toBe(400);
  });

  it('SPENDE: erhöht das gewählte Konto', async () => {
    const vor = await summary();
    const r = await agent
      .post('/admin/kasse/buchung')
      .send({ typ: 'SPENDE', konto: 'BOX', betragCent: 2500, vermerk: 'Spende Gast' });
    expect(r.status).toBe(201);
    expect(r.body.kassenTransaktion.betragCent).toBe(2500);
    const nach = await summary();
    expect(nach.boxCent).toBe(vor.boxCent + 2500);
    expect(nach.vereinsvermoegenCent).toBe(vor.vereinsvermoegenCent + 2500);
  });

  it('KORREKTUR: signiert (± erlaubt), 0 → 400', async () => {
    const null0 = await agent
      .post('/admin/kasse/buchung')
      .send({ typ: 'KORREKTUR', konto: 'BOX', betragCent: 0, vermerk: 'x' });
    expect(null0.status).toBe(400);

    const vor = await summary();
    const rPlus = await agent
      .post('/admin/kasse/buchung')
      .send({ typ: 'KORREKTUR', konto: 'BOX', betragCent: 700, vermerk: 'Box nachgezählt +' });
    expect(rPlus.status).toBe(201);
    expect(rPlus.body.kassenTransaktion.betragCent).toBe(700);
    const rMinus = await agent
      .post('/admin/kasse/buchung')
      .send({ typ: 'KORREKTUR', konto: 'BOX', betragCent: -300, vermerk: 'Box nachgezählt -' });
    expect(rMinus.status).toBe(201);
    expect(rMinus.body.kassenTransaktion.betragCent).toBe(-300);
    const nach = await summary();
    expect(nach.boxCent).toBe(vor.boxCent + 700 - 300);
  });

  it('lehnt nicht-positive Magnitude bei EINKAUF ab', async () => {
    const r0 = await agent
      .post('/admin/kasse/buchung')
      .send({ typ: 'EINKAUF', konto: 'VERWALTER', betragCent: 0, vermerk: 'x' });
    expect(r0.status).toBe(400);
    const rNeg = await agent
      .post('/admin/kasse/buchung')
      .send({ typ: 'EINKAUF', konto: 'VERWALTER', betragCent: -100, vermerk: 'x' });
    expect(rNeg.status).toBe(400);
  });

  it('EINLAGE_BOX: Topf −X, Box +X, Vereinsvermögen GLEICH, Zeilen verknüpft', async () => {
    const vor = await summary();
    const r = await agent
      .post('/admin/kasse/einlage')
      .send({ betragCent: 4000, vermerk: 'In die Box gelegt' });
    expect(r.status).toBe(201);

    expect(r.body.verwalterZeile).toMatchObject({
      typ: 'EINLAGE_BOX',
      konto: 'VERWALTER',
      verwalterId: lauraId,
      betragCent: -4000,
    });
    expect(r.body.boxZeile).toMatchObject({
      typ: 'EINLAGE_BOX',
      konto: 'BOX',
      verwalterId: null,
      betragCent: 4000,
    });
    // wechselseitige Verknüpfung
    expect(r.body.verwalterZeile.einlageGegenId).toBe(r.body.boxZeile.id);
    expect(r.body.boxZeile.einlageGegenId).toBe(r.body.verwalterZeile.id);

    const nach = await summary();
    expect(topf(nach, lauraId)).toBe(topf(vor, lauraId) - 4000);
    expect(nach.boxCent).toBe(vor.boxCent + 4000);
    expect(nach.vereinsvermoegenCent).toBe(vor.vereinsvermoegenCent); // nur Umschichtung
  });

  it('Deckung bleibt = Vereinsvermögen − Mitglieder-Summe nach allen Buchungen', async () => {
    const s = await summary();
    expect(s.deckungCent).toBe(s.vereinsvermoegenCent - s.mitgliederGuthabenSummeCent);
    const topfSum = s.toepfe.reduce((acc: number, t: { betragCent: number }) => acc + t.betragCent, 0);
    expect(topfSum + s.boxCent).toBe(s.vereinsvermoegenCent);
  });
});

// B2j.1 — Leitung-Lesezugriff auf die Kasse. Eigener Leitung-User (Lea), via
// Invite eingeloggt; Max bleibt reines Mitglied, Laura Admin.
describe('Leitung-Lesezugriff (Kasse)', () => {
  const leitungAgent = supertest.agent(app);
  let leitungId: string;

  it('Setup: Leitung-User anlegen + einloggen', async () => {
    const u = await prisma.user.create({
      data: { email: 'leitung@example.com', firstName: 'Lea', lastName: 'Leitung', isLeitung: true },
    });
    leitungId = u.id;
    const inv = generateInviteToken();
    await prisma.invite.create({
      data: { tokenHash: inv.hash, userId: u.id, expiresAt: inviteExpiry() },
    });
    const r = await leitungAgent
      .post('/auth/invite-redeem')
      .send({ token: inv.clear, password: 'Leitung-Pferd-9' });
    expect(r.status).toBe(200);
    expect(r.body.user.isLeitung).toBe(true);
    expect(r.body.user.isAdmin).toBe(false);
  });

  it('/me liefert isLeitung', async () => {
    const r = await leitungAgent.get('/auth/me');
    expect(r.status).toBe(200);
    expect(r.body.user.isLeitung).toBe(true);
    expect(r.body.user.isAdmin).toBe(false);
  });

  it('Leitung darf Kassen-Summary + Historie lesen (200)', async () => {
    expect((await leitungAgent.get('/admin/kasse/summary')).status).toBe(200);
    expect((await leitungAgent.get('/admin/kasse/historie')).status).toBe(200);
  });

  it('Leitung darf KEINE Kassen-Aktionen (buchung/einlage → 403)', async () => {
    const b = await leitungAgent
      .post('/admin/kasse/buchung')
      .send({ typ: 'EINKAUF', konto: 'BOX', betragCent: 100, vermerk: 'x' });
    expect(b.status).toBe(403);
    const e = await leitungAgent.post('/admin/kasse/einlage').send({ betragCent: 100, vermerk: 'x' });
    expect(e.status).toBe(403);
  });

  it('Leitung bekommt KEINE Mitglieder-Daten/-Aktionen (403)', async () => {
    expect((await leitungAgent.get('/admin/users')).status).toBe(403);
    expect((await leitungAgent.get(`/admin/users/${leitungId}`)).status).toBe(403);
    expect(
      (await leitungAgent.post('/admin/korrektur').send({ userId: leitungId, betragCent: 100, notiz: 'x' }))
        .status,
    ).toBe(403);
    expect((await leitungAgent.get('/admin/aufladung/anfragen')).status).toBe(403);
    expect((await leitungAgent.get('/admin/drinks')).status).toBe(403);
  });

  it('reines Mitglied (Max) bekommt Kassen-GET 403', async () => {
    expect((await memberAgent.get('/admin/kasse/summary')).status).toBe(403);
    expect((await memberAgent.get('/admin/kasse/historie')).status).toBe(403);
  });

  it('Admin behält vollen Kassen-Zugriff (summary 200)', async () => {
    expect((await agent.get('/admin/kasse/summary')).status).toBe(200);
  });

  it('Summary zeigt Mitglieder-Guthaben nur als EINE Summe (DSGVO §9)', async () => {
    const r = await leitungAgent.get('/admin/kasse/summary');
    expect(typeof r.body.mitgliederGuthabenSummeCent).toBe('number');
    // keine Pro-Person-Salden im Payload, toepfe sind nur Verwalter-Töpfe
    expect(r.body).not.toHaveProperty('mitgliederGuthaben');
    expect(Array.isArray(r.body.toepfe)).toBe(true);
  });
});

// B2j.2 — Leitung-Recht vergeben/entziehen (Admin-only). Nutzt Max als Ziel und
// prüft end-to-end, dass das frisch gesetzte Recht ohne Re-Login wirkt.
describe('Leitung-Recht vergeben (Admin)', () => {
  let maxId: string;

  it('Setup: Max-Id', async () => {
    maxId = (await memberAgent.get('/auth/me')).body.user.id;
  });

  it('lehnt das Setzen ohne Admin-Recht ab (403)', async () => {
    const r = await memberAgent.patch(`/admin/users/${maxId}/leitung`).send({ isLeitung: true });
    expect(r.status).toBe(403);
  });

  it('antwortet 404 bei unbekannter ID', async () => {
    const r = await agent.patch('/admin/users/gibts-nicht/leitung').send({ isLeitung: true });
    expect(r.status).toBe(404);
  });

  it('lehnt fehlendes/ungültiges isLeitung ab (400)', async () => {
    const r = await agent.patch(`/admin/users/${maxId}/leitung`).send({});
    expect(r.status).toBe(400);
  });

  it('Admin vergibt Leitung — setzt nur isLeitung, nicht isAdmin', async () => {
    const r = await agent.patch(`/admin/users/${maxId}/leitung`).send({ isLeitung: true });
    expect(r.status).toBe(200);
    expect(r.body.user).toMatchObject({ id: maxId, isLeitung: true, isAdmin: false });
    // /me des Mitglieds spiegelt es (ohne Re-Login)
    const me = await memberAgent.get('/auth/me');
    expect(me.body.user.isLeitung).toBe(true);
    expect(me.body.user.isAdmin).toBe(false);
  });

  it('frisch vergebenes Recht wirkt sofort: Max liest jetzt die Kasse (200)', async () => {
    expect((await memberAgent.get('/admin/kasse/summary')).status).toBe(200);
    expect((await memberAgent.get('/admin/kasse/historie')).status).toBe(200);
    // aber weiterhin keine Schreib-Aktion + keine Mitglieder-Endpoints
    expect(
      (await memberAgent.post('/admin/kasse/buchung').send({ typ: 'EINKAUF', konto: 'BOX', betragCent: 100, vermerk: 'x' }))
        .status,
    ).toBe(403);
    expect((await memberAgent.get('/admin/users')).status).toBe(403);
  });

  it('Admin entzieht Leitung wieder → Max verliert den Kassen-Zugriff (403)', async () => {
    const r = await agent.patch(`/admin/users/${maxId}/leitung`).send({ isLeitung: false });
    expect(r.status).toBe(200);
    expect(r.body.user.isLeitung).toBe(false);
    expect((await memberAgent.get('/admin/kasse/summary')).status).toBe(403);
  });
});

// B2k.1 — Verwalter ernennen (isAdmin-Toggle) + Letzter-Admin-Schutz. requireAdmin
// ist jetzt DB-backed → Rechte wirken sofort ohne Re-Login. Baseline am Ende
// wiederhergestellt (Laura einziger Admin, Max Mitglied).
describe('Verwalter ernennen (Admin)', () => {
  let lauraId: string;
  let maxId: string;

  it('Setup: IDs', async () => {
    lauraId = (await agent.get('/auth/me')).body.user.id;
    maxId = (await memberAgent.get('/auth/me')).body.user.id;
  });

  it('lehnt das Setzen ohne Admin-Recht ab (403)', async () => {
    const r = await memberAgent.patch(`/admin/users/${maxId}/admin`).send({ isAdmin: true });
    expect(r.status).toBe(403);
  });

  it('antwortet 404 bei unbekannter ID', async () => {
    const r = await agent.patch('/admin/users/gibts-nicht/admin').send({ isAdmin: true });
    expect(r.status).toBe(404);
  });

  it('lehnt ungültiges isAdmin ab (400)', async () => {
    const r = await agent.patch(`/admin/users/${maxId}/admin`).send({});
    expect(r.status).toBe(400);
  });

  it('Letzter-Admin-Schutz: der einzige aktive Admin kann sich nicht entziehen (400)', async () => {
    const r = await agent.patch(`/admin/users/${lauraId}/admin`).send({ isAdmin: false });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/letzte/i);
    // Laura ist weiter Admin
    expect((await agent.get('/auth/me')).body.user.isAdmin).toBe(true);
  });

  it('ernennt Max zum Verwalter — wirkt sofort (ohne Re-Login)', async () => {
    const r = await agent.patch(`/admin/users/${maxId}/admin`).send({ isAdmin: true });
    expect(r.status).toBe(200);
    expect(r.body.user).toMatchObject({ id: maxId, isAdmin: true });
    // /me spiegelt es; und der Admin-Zugriff greift sofort trotz altem JWT
    expect((await memberAgent.get('/auth/me')).body.user.isAdmin).toBe(true);
    expect((await memberAgent.get('/admin/users')).status).toBe(200);
  });

  it('Selbst-Entzug erlaubt, solange ein weiterer Admin bleibt (Baseline-Restore)', async () => {
    // Max (jetzt Admin) entzieht sich selbst — Laura bleibt Admin → erlaubt.
    const r = await memberAgent.patch(`/admin/users/${maxId}/admin`).send({ isAdmin: false });
    expect(r.status).toBe(200);
    expect(r.body.user.isAdmin).toBe(false);
    // Admin-Zugriff sofort weg
    expect((await memberAgent.get('/admin/users')).status).toBe(403);
  });
});

// B2k.2 — paypal.me-Profil (eigener Link). Am Ende auf 'laura-test'
// zurückgesetzt, damit der Stand für die Lastverteilung-Tests vorhersehbar ist.
describe('paypal.me-Profil (eigener Link)', () => {
  it('lehnt das Pflegen ohne Admin-Recht ab (403)', async () => {
    const r = await memberAgent.patch('/admin/me/paypal').send({ paypalMeLink: 'max' });
    expect(r.status).toBe(403);
  });

  it('setzt den eigenen Link und normalisiert auf den Handle', async () => {
    const r = await agent.patch('/admin/me/paypal').send({ paypalMeLink: 'https://paypal.me/laura-neu' });
    expect(r.status).toBe(200);
    expect(r.body.user.paypalMeLink).toBe('laura-neu');
    // /me liefert den Link mit
    expect((await agent.get('/auth/me')).body.user.paypalMeLink).toBe('laura-neu');
  });

  it('ändert den Link', async () => {
    const r = await agent.patch('/admin/me/paypal').send({ paypalMeLink: 'paypal.me/laura2' });
    expect(r.status).toBe(200);
    expect(r.body.user.paypalMeLink).toBe('laura2');
  });

  it('leert den Link (null)', async () => {
    const r = await agent.patch('/admin/me/paypal').send({ paypalMeLink: null });
    expect(r.status).toBe(200);
    expect(r.body.user.paypalMeLink).toBeNull();
    expect((await agent.get('/auth/me')).body.user.paypalMeLink).toBeNull();
  });

  it('lehnt einen ungültigen Link ab (400)', async () => {
    const r = await agent.patch('/admin/me/paypal').send({ paypalMeLink: 'hat leerzeichen' });
    expect(r.status).toBe(400);
  });

  it('Restore: Lauras Link auf laura-test', async () => {
    const r = await agent.patch('/admin/me/paypal').send({ paypalMeLink: 'laura-test' });
    expect(r.status).toBe(200);
    expect(r.body.user.paypalMeLink).toBe('laura-test');
  });
});

// B2k.3 — Lastverteilung (§6.9). Isoliert: Laura-Link kurz entfernt, damit nur
// zwei frische Verwalter (Anna, Bert) wählbar sind; Töpfe gezielt befüllt.
describe('Lastverteilung (§6.9)', () => {
  const annaAgent = supertest.agent(app);
  const bertAgent = supertest.agent(app);
  let annaId: string;
  let bertId: string;

  async function topf(verwalterId: string): Promise<number> {
    const agg = await prisma.kassenTransaktion.aggregate({
      _sum: { betragCent: true },
      where: { konto: 'VERWALTER', verwalterId },
    });
    return agg._sum.betragCent ?? 0;
  }

  async function loginVerwalter(
    agentInst: ReturnType<typeof supertest.agent>,
    email: string,
    firstName: string,
    link: string,
  ): Promise<string> {
    const u = await prisma.user.create({
      data: { email, firstName, lastName: 'V', isAdmin: true, paypalMeLink: link },
    });
    const inv = generateInviteToken();
    await prisma.invite.create({ data: { tokenHash: inv.hash, userId: u.id, expiresAt: inviteExpiry() } });
    const r = await agentInst.post('/auth/invite-redeem').send({ token: inv.clear, password: 'Verwalter-Pferd-9' });
    expect(r.status).toBe(200);
    expect(r.body.user.isAdmin).toBe(true);
    return u.id;
  }

  it('Setup: Laura-Link entfernen, Anna + Bert als Verwalter anlegen', async () => {
    await agent.patch('/admin/me/paypal').send({ paypalMeLink: null });
    annaId = await loginVerwalter(annaAgent, 'anna@example.com', 'Anna', 'anna');
    bertId = await loginVerwalter(bertAgent, 'bert@example.com', 'Bert', 'bert');
  });

  it('Tie-Break: bei Gleichstand gewinnt firstName alphabetisch (Anna)', async () => {
    // Beide Töpfe 0, keine offenen Anfragen → Gleichstand → Anna < Bert.
    const r = await memberAgent.get('/aufladung/zustaendiger-verwalter');
    expect(r.status).toBe(200);
    expect(r.body.verwalter.id).toBe(annaId);
  });

  it('Setup: Annas Topf auf -100 senken (Einkauf aus eigenem Topf)', async () => {
    const r = await annaAgent
      .post('/admin/kasse/buchung')
      .send({ typ: 'EINKAUF', konto: 'VERWALTER', betragCent: 100, vermerk: 'Anna Einkauf' });
    expect(r.status).toBe(201);
    expect(await topf(annaId)).toBe(-100);
    expect(await topf(bertId)).toBe(0);
  });

  it('niedrigste effektive Summe gewinnt (Anna, -100 < 0)', async () => {
    const r = await memberAgent.get('/aufladung/zustaendiger-verwalter');
    expect(r.body.verwalter.id).toBe(annaId);
  });

  it('erste Anfrage geht an Anna + liefert deren Link', async () => {
    const r = await memberAgent.post('/aufladung/paypal').send({ betragCent: 500 });
    expect(r.status).toBe(201);
    expect(r.body.anfrage.zugewiesenerVerwalterId).toBe(annaId);
    expect(r.body.verwalter).toMatchObject({ id: annaId, paypalMeLink: 'anna' });
  });

  it('zweite Anfrage geht an Bert (offene Anfrage hebt Annas effektiven Stand: -100+500=400 > 0)', async () => {
    const r = await memberAgent.post('/aufladung/paypal').send({ betragCent: 500 });
    expect(r.status).toBe(201);
    expect(r.body.anfrage.zugewiesenerVerwalterId).toBe(bertId);
    expect(r.body.verwalter).toMatchObject({ id: bertId, paypalMeLink: 'bert' });
  });

  it('Anfragen-Liste ist je Verwalter auf eigene zugewiesene gefiltert', async () => {
    const annaListe = await annaAgent.get('/admin/aufladung/anfragen');
    const bertListe = await bertAgent.get('/admin/aufladung/anfragen');
    expect(annaListe.body.anfragen.every((a: { zugewiesenerVerwalterId: string }) => a.zugewiesenerVerwalterId === annaId)).toBe(true);
    expect(bertListe.body.anfragen.every((a: { zugewiesenerVerwalterId: string }) => a.zugewiesenerVerwalterId === bertId)).toBe(true);
    // Annas Anfrage taucht nicht in Berts Liste auf und umgekehrt
    expect(annaListe.body.anfragen.length).toBeGreaterThanOrEqual(1);
    expect(bertListe.body.anfragen.length).toBeGreaterThanOrEqual(1);
  });

  it('Bestätigen nur durch den Zugewiesenen: Anna kann Berts Anfrage nicht (403)', async () => {
    const bertAnfrage = await prisma.aufladungsAnfrage.findFirst({
      where: { zugewiesenerVerwalterId: bertId, status: 'OFFEN' },
    });
    const r = await annaAgent.post(`/admin/aufladung/anfragen/${bertAnfrage!.id}/bestaetigen`).send({});
    expect(r.status).toBe(403);
  });

  it('Bert bestätigt seine Anfrage → EINZAHLUNG landet in Berts Topf', async () => {
    const bertAnfrage = await prisma.aufladungsAnfrage.findFirst({
      where: { zugewiesenerVerwalterId: bertId, status: 'OFFEN' },
    });
    const topfVor = await topf(bertId);
    const r = await bertAgent.post(`/admin/aufladung/anfragen/${bertAnfrage!.id}/bestaetigen`).send({});
    expect(r.status).toBe(201);
    expect(r.body.kassenTransaktion).toMatchObject({ konto: 'VERWALTER', verwalterId: bertId, betragCent: 500 });
    expect(await topf(bertId)).toBe(topfVor + 500);
  });

  it('Ablehnen nur durch den Zugewiesenen: Bert kann Annas Anfrage nicht (403)', async () => {
    const annaAnfrage = await prisma.aufladungsAnfrage.findFirst({
      where: { zugewiesenerVerwalterId: annaId, status: 'OFFEN' },
    });
    const r = await bertAgent.post(`/admin/aufladung/anfragen/${annaAnfrage!.id}/ablehnen`).send({});
    expect(r.status).toBe(403);
  });

  it('Anna lehnt ihre eigene Anfrage ab (200)', async () => {
    const annaAnfrage = await prisma.aufladungsAnfrage.findFirst({
      where: { zugewiesenerVerwalterId: annaId, status: 'OFFEN' },
    });
    const r = await annaAgent.post(`/admin/aufladung/anfragen/${annaAnfrage!.id}/ablehnen`).send({});
    expect(r.status).toBe(200);
    expect(r.body.anfrage.status).toBe('ABGELEHNT');
  });

  it('kein Verwalter mit Link → PayPal-Anfrage 400 (kein Crash)', async () => {
    await annaAgent.patch('/admin/me/paypal').send({ paypalMeLink: null });
    await bertAgent.patch('/admin/me/paypal').send({ paypalMeLink: null });
    const preview = await memberAgent.get('/aufladung/zustaendiger-verwalter');
    expect(preview.body.verwalter).toBeNull();
    const r = await memberAgent.post('/aufladung/paypal').send({ betragCent: 500 });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/kein verwalter mit paypal/i);
  });

  it('Restore: Lauras Link wieder setzen', async () => {
    const r = await agent.patch('/admin/me/paypal').send({ paypalMeLink: 'laura-test' });
    expect(r.status).toBe(200);
  });
});

// B3 — Sortenstatistik. Isoliert über einen frischen Drink mit gezielt gesetzten
// Käufen (recent/alt/storniert), Asserts auf genau dessen Zeile.
describe('Sortenstatistik (B3)', () => {
  let saftId: string;
  let maxId: string;
  let leitungAgent: ReturnType<typeof supertest.agent>;

  function saftRow(body: any) {
    return body.sorten.find((s: { drinkId: string }) => s.drinkId === saftId);
  }

  it('Setup: Drink + Käufe (recent/alt/storniert) + Leitung-Login', async () => {
    maxId = (await memberAgent.get('/auth/me')).body.user.id;
    const drink = await prisma.drink.create({
      data: { name: 'TestSaft B3', preisCent: 250, icon: '🧃', kategorie: 'alkoholfrei' },
    });
    saftId = drink.id;

    const now = new Date();
    async function kauf(createdAt: Date) {
      return prisma.transaktion.create({
        data: {
          typ: 'KAUF',
          userId: maxId,
          erstelltVonId: maxId,
          drinkId: saftId,
          preisAtKaufCent: 250,
          betragCent: -250,
          createdAt,
        },
      });
    }
    const k1 = await kauf(now);
    await kauf(now);
    await kauf(now);
    // Storno auf k1 → ausgeschlossen, egal wann gebucht
    await prisma.transaktion.create({
      data: {
        typ: 'STORNO',
        userId: maxId,
        erstelltVonId: maxId,
        stornoVonId: k1.id,
        betragCent: 250,
        notiz: 'Teststorno',
      },
    });
    // alter Kauf 40 Tage zurück (im Quartal, nicht im Monat)
    await kauf(new Date(Date.now() - 40 * 24 * 60 * 60 * 1000));

    leitungAgent = supertest.agent(app);
    const r = await leitungAgent
      .post('/auth/login')
      .send({ email: 'leitung@example.com', password: 'Leitung-Pferd-9' });
    expect(r.status).toBe(200);
  });

  it('lehnt ohne Login (401) und als reines Mitglied (403) ab', async () => {
    const anon = supertest.agent(app);
    expect((await anon.get('/statistik/sorten')).status).toBe(401);
    expect((await memberAgent.get('/statistik/sorten')).status).toBe(403);
  });

  it('Admin UND Leitung dürfen lesen (200)', async () => {
    expect((await agent.get('/statistik/sorten')).status).toBe(200);
    expect((await leitungAgent.get('/statistik/sorten')).status).toBe(200);
  });

  it('aggregiert Anzahl + Umsatz, schließt Stornos aus (monat)', async () => {
    const row = saftRow((await agent.get('/statistik/sorten?zeitraum=monat')).body);
    expect(row).toMatchObject({
      name: 'TestSaft B3',
      kategorie: 'alkoholfrei',
      icon: '🧃',
      anzahl: 2,
      umsatzCent: 500,
    });
  });

  it('Zeitfilter: quartal enthält den alten Kauf, woche/monat nicht', async () => {
    const woche = saftRow((await agent.get('/statistik/sorten?zeitraum=woche')).body);
    const monat = saftRow((await agent.get('/statistik/sorten?zeitraum=monat')).body);
    const quartal = saftRow((await agent.get('/statistik/sorten?zeitraum=quartal')).body);
    expect(woche.anzahl).toBe(2);
    expect(monat.anzahl).toBe(2);
    expect(quartal.anzahl).toBe(3);
  });

  it('nutzt den eingefrorenen preisAtKaufCent, nicht den aktuellen Drink-Preis', async () => {
    await prisma.drink.update({ where: { id: saftId }, data: { preisCent: 999 } });
    const row = saftRow((await agent.get('/statistik/sorten?zeitraum=monat')).body);
    expect(row.umsatzCent).toBe(500); // 2 × eingefrorene 250, nicht 2 × 999
  });

  it('Default-Zeitraum ist monat (fehlender/ungültiger Param)', async () => {
    expect((await agent.get('/statistik/sorten')).body.zeitraum).toBe('monat');
    expect((await agent.get('/statistik/sorten?zeitraum=quatsch')).body.zeitraum).toBe('monat');
  });

  it('DSGVO: kein User-Bezug in der Antwort, nur Drink-Totale + Gesamtsummen', async () => {
    const r = await agent.get('/statistik/sorten?zeitraum=quartal');
    expect(JSON.stringify(r.body)).not.toMatch(/userId/i);
    expect(r.body).not.toHaveProperty('users');
    expect(saftRow(r.body)).not.toHaveProperty('userId');
    expect(typeof r.body.gesamtAnzahl).toBe('number');
    expect(typeof r.body.gesamtUmsatzCent).toBe('number');
  });
});

// B4.1 — Eigene Transaktions-Historie. Frischer User Jana, strikt eigene Daten.
describe('Eigene Historie /me/transaktionen (B4)', () => {
  const janaAgent = supertest.agent(app);
  let janaId: string;

  it('Setup: Jana + Login + eigene Transaktionen (inkl. Storno)', async () => {
    const u = await prisma.user.create({
      data: { email: 'jana@example.com', firstName: 'Jana', lastName: 'J' },
    });
    janaId = u.id;
    const inv = generateInviteToken();
    await prisma.invite.create({ data: { tokenHash: inv.hash, userId: u.id, expiresAt: inviteExpiry() } });
    const r = await janaAgent.post('/auth/invite-redeem').send({ token: inv.clear, password: 'Jana-Pferd-9' });
    expect(r.status).toBe(200);

    const drink = await prisma.drink.create({
      data: { name: 'Jana-Limo', preisCent: 150, kategorie: 'alkoholfrei' },
    });
    await prisma.transaktion.create({
      data: { typ: 'AUFLADUNG_BARGELD', userId: janaId, erstelltVonId: janaId, betragCent: 2000, notiz: 'Start' },
    });
    await prisma.transaktion.create({
      data: { typ: 'KAUF', userId: janaId, erstelltVonId: janaId, drinkId: drink.id, preisAtKaufCent: 150, betragCent: -150 },
    });
    const kauf2 = await prisma.transaktion.create({
      data: { typ: 'KAUF', userId: janaId, erstelltVonId: janaId, drinkId: drink.id, preisAtKaufCent: 150, betragCent: -150 },
    });
    await prisma.transaktion.create({
      data: { typ: 'STORNO', userId: janaId, erstelltVonId: janaId, stornoVonId: kauf2.id, betragCent: 150, notiz: 'undo' },
    });
  });

  it('lehnt ohne Login ab (401)', async () => {
    const anon = supertest.agent(app);
    expect((await anon.get('/me/transaktionen')).status).toBe(401);
  });

  it('liefert eigene Historie desc + storniert-Flag + drinkName + dabeiSeitTage', async () => {
    const r = await janaAgent.get('/me/transaktionen');
    expect(r.status).toBe(200);
    const txs = r.body.transaktionen as Array<{
      typ: string;
      drinkName: string | null;
      storniert: boolean;
      createdAt: string;
    }>;
    // chronologisch absteigend
    const zeiten = txs.map((t) => new Date(t.createdAt).getTime());
    expect(zeiten).toEqual([...zeiten].sort((a, b) => b - a));
    // der stornierte Kauf ist markiert
    expect(txs.some((t) => t.typ === 'KAUF' && t.storniert)).toBe(true);
    // Drink-Name bei KAUF sichtbar
    expect(txs.some((t) => t.drinkName === 'Jana-Limo')).toBe(true);
    expect(typeof r.body.dabeiSeitTage).toBe('number');
    // kein userId-Leak im Payload
    expect(JSON.stringify(txs)).not.toMatch(/"userId"/);
  });

  it('zeigt NUR eigene Daten — Max sieht Janas Buchungen nicht', async () => {
    const maxRes = await memberAgent.get('/me/transaktionen');
    const maxTxs = maxRes.body.transaktionen as Array<{ drinkName: string | null }>;
    expect(maxTxs.every((t) => t.drinkName !== 'Jana-Limo')).toBe(true);
  });
});

// B4.2 — Trinkjournal-Stats. Synthetische Mehrtage-Daten (explizite createdAt)
// für Streak/Pause; frische User, isoliert.
describe('Trinkjournal /journal (B4)', () => {
  let saftId: string;

  async function neuerUserAgent(email: string, firstName: string) {
    const u = await prisma.user.create({ data: { email, firstName, lastName: 'T' } });
    const inv = generateInviteToken();
    await prisma.invite.create({ data: { tokenHash: inv.hash, userId: u.id, expiresAt: inviteExpiry() } });
    const ag = supertest.agent(app);
    const r = await ag.post('/auth/invite-redeem').send({ token: inv.clear, password: 'Journal-Pferd-9' });
    expect(r.status).toBe(200);
    return { id: u.id, ag };
  }
  async function kaufVor(userId: string, tageZurueck: number) {
    return prisma.transaktion.create({
      data: {
        typ: 'KAUF',
        userId,
        erstelltVonId: userId,
        drinkId: saftId,
        preisAtKaufCent: 200,
        betragCent: -200,
        createdAt: new Date(Date.now() - tageZurueck * 86_400_000),
      },
    });
  }

  it('Setup: Drink', async () => {
    const d = await prisma.drink.create({ data: { name: 'Journal-Saft', preisCent: 200, kategorie: 'alkoholfrei' } });
    saftId = d.id;
  });

  it('lehnt /journal ohne Login ab (401)', async () => {
    const anon = supertest.agent(app);
    expect((await anon.get('/journal')).status).toBe(401);
  });

  it('Streak/Pause/Hero/Achievements aus synthetischen Mehrtage-Daten', async () => {
    const { id, ag } = await neuerUserAgent('tobi@example.com', 'Tobi');
    // heute: 3 gültige + 1 stornierter; gestern: 1; vorgestern: 1; vor 6 Tagen: 1
    await kaufVor(id, 0);
    await kaufVor(id, 0);
    await kaufVor(id, 0);
    const storno = await kaufVor(id, 0);
    await prisma.transaktion.create({
      data: { typ: 'STORNO', userId: id, erstelltVonId: id, stornoVonId: storno.id, betragCent: 200, notiz: 'undo' },
    });
    await kaufVor(id, 1);
    await kaufVor(id, 2);
    await kaufVor(id, 6);
    // Aufladung für den Hamster (Guthaben > 50 €)
    await prisma.transaktion.create({
      data: { typ: 'AUFLADUNG_BARGELD', userId: id, erstelltVonId: id, betragCent: 10000, notiz: 'Start' },
    });

    const r = await ag.get('/journal');
    expect(r.status).toBe(200);
    // 6 gültige Käufe (4 heute − 1 storniert = 3, + gestern + vorgestern + vor 6 Tagen)
    expect(r.body.gesamtKaeufe).toBe(6);
    // Streak: heute, gestern, vorgestern → 3 (Tag 3 fehlt)
    expect(r.body.streak).toBe(3);
    // Längste Pause: Tage 3/4/5 zwischen Tag 6 und Tag 2 → 3
    expect(r.body.laengstePause).toBe(3);
    // Heutiger Verlaufs-Balken zählt 3 (stornierter nicht)
    const heuteKey = new Date().toISOString().slice(0, 10);
    const heuteBalken = r.body.verlauf30.find((v: { datum: string }) => v.datum === heuteKey);
    expect(heuteBalken.anzahl).toBe(3);
    expect(r.body.verlauf30).toHaveLength(30);
    // diese Woche + Monat enthalten mindestens die heutigen 3
    expect(r.body.dieseWoche).toBeGreaterThanOrEqual(3);
    expect(r.body.heroMonat).toBeGreaterThanOrEqual(3);

    const ach = (key: string) => r.body.achievements.find((a: { key: string }) => a.key === key);
    expect(ach('erstbesteigung').freigeschaltet).toBe(true);
    expect(ach('huettenabend').freigeschaltet).toBe(true); // 3 an einem Tag
    expect(ach('trockenwoche').freigeschaltet).toBe(false); // Pause 3 < 7
    expect(ach('tourenrucksack').freigeschaltet).toBe(false); // 6 < 20
    expect(ach('stammgast').freigeschaltet).toBe(false); // 6 < 100
    expect(ach('hamster').freigeschaltet).toBe(true); // Guthaben 10000 − 1200 > 5000
    expect(ach('seilschaft')).toMatchObject({ freigeschaltet: false, gesperrt: true });
  });

  it('Trockenwoche schaltet bei Pause ≥ 7 frei; Streak bleibt korrekt', async () => {
    const { id, ag } = await neuerUserAgent('uwe@example.com', 'Uwe');
    await kaufVor(id, 0); // heute
    await kaufVor(id, 10); // vor 10 Tagen → Lücke Tag 1..9 = 9 Tage
    const r = await ag.get('/journal');
    expect(r.body.laengstePause).toBe(9);
    expect(r.body.achievements.find((a: { key: string }) => a.key === 'trockenwoche').freigeschaltet).toBe(true);
    expect(r.body.streak).toBe(1); // nur heute (gestern keine Buchung)
  });

  it('leeres Journal: keine Käufe → Streak 0, Pause 0, nichts außer Erstbesteigung-Lock', async () => {
    const { ag } = await neuerUserAgent('vera@example.com', 'Vera');
    const r = await ag.get('/journal');
    expect(r.body.gesamtKaeufe).toBe(0);
    expect(r.body.streak).toBe(0);
    expect(r.body.laengstePause).toBe(0);
    expect(r.body.heroMonat).toBe(0);
    expect(r.body.achievements.find((a: { key: string }) => a.key === 'erstbesteigung').freigeschaltet).toBe(false);
  });
});

// B5a — Berlin-Tagesgrenzen (Europe/Berlin) für die Journal-Buckets. Deterministisch
// über feste Instants getestet, inkl. Mitternachts-Übergang und DST (CET/CEST).
describe('berlinDayKey (Europe/Berlin)', () => {
  it('Winter (CET, UTC+1): 22:30Z bleibt am selben Tag, 23:30Z kippt über Mitternacht', () => {
    // 2026-03-15 ist vor der DST-Umstellung (Ende März) → CET (UTC+1).
    expect(berlinDayKey(new Date('2026-03-15T22:30:00Z'))).toBe('2026-03-15'); // 23:30 Berlin
    expect(berlinDayKey(new Date('2026-03-15T23:30:00Z'))).toBe('2026-03-16'); // 00:30 Berlin
  });

  it('Sommer (CEST, UTC+2): 21:30Z selber Tag, 22:30Z kippt über Mitternacht', () => {
    // Juli → CEST (UTC+2).
    expect(berlinDayKey(new Date('2026-07-15T21:30:00Z'))).toBe('2026-07-15'); // 23:30 Berlin
    expect(berlinDayKey(new Date('2026-07-15T22:30:00Z'))).toBe('2026-07-16'); // 00:30 Berlin
  });

  it('Mittags-Instants liegen in beiden Zeitzonen am Kalendertag', () => {
    expect(berlinDayKey(new Date('2026-01-10T12:00:00Z'))).toBe('2026-01-10');
    expect(berlinDayKey(new Date('2026-08-10T12:00:00Z'))).toBe('2026-08-10');
  });
});
