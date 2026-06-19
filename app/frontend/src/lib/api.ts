// Relativer Pfad über den Vite-Dev-Proxy (`/api` → Backend, siehe vite.config).
// So gehen API-Calls immer an DENSELBEN Origin, von dem die Seite geladen wurde
// (localhost ODER LAN-IP); Vite proxyt sie serverseitig ans Backend. Kein
// hartkodiertes localhost mehr → funktioniert vom Handy im WLAN, ohne Cross-
// Origin/CORS/Cookie-Probleme. Override via VITE_API_URL (z.B. für Prod-Deploy).
const BASE = import.meta.env.VITE_API_URL ?? '/api';

export interface ApiUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  guthabenCent: number;
  isAdmin: boolean;
  isLeitung: boolean;
  paypalMeLink: string | null;
  whatsappNummer: string | null;
  isActive: boolean;
}

export interface AdminInvite {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  expiresAt: string;
  redeemedAt: string | null;
  status: 'offen' | 'eingeloest' | 'abgelaufen';
}

export const DRINK_KATEGORIEN = ['alkoholfrei', 'alkoholisch', 'sonstiges'] as const;
export type DrinkKategorie = (typeof DRINK_KATEGORIEN)[number];

export interface Drink {
  id: string;
  name: string;
  preisCent: number;
  icon: string | null;
  kategorie: DrinkKategorie;
  marke: string | null;
  volumenMl: number | null;
  // Komprimiertes Etikett-JPEG als Data-URL (Drink-Fotos), null = kein Bild.
  bildDataUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DrinkInput {
  name: string;
  preisCent: number;
  icon?: string;
  kategorie: DrinkKategorie;
  // marke: leerer String löscht (Update). volumenMl: null löscht, sonst Int > 0.
  marke?: string | null;
  volumenMl?: number | null;
  // bildDataUrl: Data-URL setzt das Etikett, '' oder null entfernt es (Update).
  bildDataUrl?: string | null;
}

export const TRANSAKTION_TYPEN = [
  'KAUF',
  'AUFLADUNG_PAYPAL',
  'AUFLADUNG_BARGELD',
  'KORREKTUR',
  'STORNO',
] as const;
export type TransaktionTyp = (typeof TRANSAKTION_TYPEN)[number];

export interface Transaktion {
  id: string;
  userId: string;
  typ: TransaktionTyp;
  betragCent: number;
  drinkId: string | null;
  preisAtKaufCent: number | null;
  stornoVonId: string | null;
  notiz: string | null;
  erstelltVonId: string;
  kassenTransaktionId: string | null;
  createdAt: string;
}

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isAdmin: boolean;
  guthabenCent: number;
  // Bündel 2: kommt jetzt immer mit; bei includeInactive zeigt die Liste auch
  // deaktivierte Mitglieder (isActive=false).
  isActive: boolean;
}

export interface KassenTransaktion {
  id: string;
  typ: string;
  konto: string;
  verwalterId: string | null;
  betragCent: number;
  notiz: string;
  transaktionId: string | null;
  einlageGegenId: string | null;
  erstelltVonId: string;
  createdAt: string;
}

// Öffentliche Verwalter-Sicht (kein passwordHash o.ä.), wie vom Backend geliefert.
// Bündel 5: Die member-initiierte AufladungsAnfrage entfällt — übrig bleibt nur die
// Anzeige des zuständigen Verwalters (Name + paypal.me + WhatsApp) im Aufladen-Tab.
export interface VerwalterPublic {
  id: string;
  firstName: string;
  lastName: string;
  paypalMeLink: string | null;
  whatsappNummer: string | null;
}

// Mitglied-Detail (B2g): Stammdaten + Live-Saldo.
export interface AdminUserDetail {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isAdmin: boolean;
  isLeitung: boolean;
  isActive: boolean;
  guthabenCent: number;
}

// Eine Zeile der Transaktionshistorie im Mitglied-Detail (B2g).
export interface DetailTransaktion {
  id: string;
  typ: TransaktionTyp;
  betragCent: number;
  notiz: string | null;
  drinkName: string | null;
  stornoVonId: string | null;
  createdAt: string;
  storniert: boolean;
  stornierbar: boolean;
}

// Kassen-Screen (B2i).
export interface KassenTopf {
  verwalterId: string;
  firstName: string;
  lastName: string;
  betragCent: number;
}

export interface KassenSummary {
  toepfe: KassenTopf[];
  boxCent: number;
  vereinsvermoegenCent: number;
  mitgliederGuthabenSummeCent: number;
  deckungCent: number;
}

export interface KassenHistorieEintrag {
  id: string;
  typ: string;
  konto: string;
  verwalterId: string | null;
  verwalterName: string | null;
  betragCent: number;
  notiz: string;
  transaktionId: string | null;
  einlageGegenId: string | null;
  // Bündel 3, Einheit 3: Storno-Markierung. stornoVonId gesetzt = diese Zeile IST
  // eine Storno-Gegenbuchung; storniert = eine andere Zeile storniert diese;
  // stornierbar = darf per Storno-Button rückgebucht werden.
  stornoVonId: string | null;
  storniert: boolean;
  stornierbar: boolean;
  createdAt: string;
}

// Methode der admin-direkten Einzahlung (Bündel 3, Einheit 2).
export type EinzahlungMethode = 'BAR' | 'PAYPAL';

// Einzeilige Kassen-Aktionen (EINLAGE_BOX hat einen eigenen Endpoint).
export type KassenBuchungTyp = 'EINKAUF' | 'ENTNAHME' | 'SPENDE' | 'KORREKTUR';
export type KassenKonto = 'VERWALTER' | 'BOX';

// Sortenstatistik (B3) — app-weit anonym aggregiert. Bündel 2: Woche raus, Jahr
// rein (rollierende letzte 365 Tage = „letzte 12 Monate").
export type StatistikZeitraum = 'monat' | 'quartal' | 'jahr';

export interface SortenStat {
  drinkId: string;
  name: string;
  icon: string | null;
  kategorie: string | null;
  anzahl: number;
  umsatzCent: number;
}

export interface SortenStatistik {
  zeitraum: StatistikZeitraum;
  seit: string;
  sorten: SortenStat[];
  gesamtAnzahl: number;
  gesamtUmsatzCent: number;
}

// Trinkjournal (B4) — privat, eigene Daten.
export interface JournalAchievement {
  key: string;
  emoji: string;
  titel: string;
  beschreibung: string;
  freigeschaltet: boolean;
  gesperrt?: boolean;
  fortschritt?: { ist: number; ziel: number };
}

export interface VerlaufTag {
  datum: string;
  anzahl: number;
  istWochenende: boolean;
}

export interface Journal {
  heroMonat: number;
  dieseWoche: number;
  streak: number;
  laengstePause: number;
  gesamtKaeufe: number;
  verlauf30: VerlaufTag[];
  achievements: JournalAchievement[];
}

export interface MeineTransaktion {
  id: string;
  typ: TransaktionTyp;
  betragCent: number;
  notiz: string | null;
  drinkName: string | null;
  stornoVonId: string | null;
  createdAt: string;
  storniert: boolean;
}

export interface MeineHistorie {
  transaktionen: MeineTransaktion[];
  dabeiSeitTage: number;
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    ...init,
  });

  const raw = await res.text();
  const parsed = raw ? (JSON.parse(raw) as unknown) : undefined;

  if (!res.ok) {
    const message =
      (parsed as { error?: string } | undefined)?.error ?? `HTTP ${res.status}`;
    throw new ApiError(res.status, message, parsed);
  }
  return parsed as T;
}

export const api = {
  me: () => request<{ user: ApiUser }>('/auth/me'),
  login: (email: string, password: string) =>
    request<{ user: ApiUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  redeem: (token: string, password: string) =>
    request<{ user: ApiUser }>('/auth/invite-redeem', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),
  logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }),
  adminInvite: (input: {
    email: string;
    firstName: string;
    lastName: string;
    isAdmin?: boolean;
    isLeitung?: boolean;
  }) =>
    request<{
      user: { id: string; email: string; firstName: string; lastName: string };
      devToken?: string;
    }>('/admin/invite', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  // Admin: Passwort-Reset für bestehenden User → liefert Klartext-Token (Dev),
  // Frontend baut den kopierbaren Reset-Link daraus (wie beim Invite)
  adminResetPassword: (id: string) =>
    request<{
      user: { id: string; email: string; firstName: string };
      devToken?: string;
    }>(`/admin/users/${id}/reset-password`, { method: 'POST' }),
  adminInvites: () => request<{ invites: AdminInvite[] }>('/admin/invites'),
  // Admin: einen ausgestellten Invite löschen. Verwaister Platzhalter-User wird
  // mitentfernt (userGeloescht=true); aktivierte/transaktions-behaftete bleiben.
  adminDeleteInvite: (id: string) =>
    request<{ ok: true; userGeloescht: boolean }>(`/admin/invites/${id}`, { method: 'DELETE' }),
  adminDrinks: () => request<{ drinks: Drink[] }>('/admin/drinks'),
  adminDrinkCreate: (input: DrinkInput) =>
    request<{ drink: Drink }>('/admin/drinks', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  adminDrinkUpdate: (id: string, input: Partial<DrinkInput>) =>
    request<{ drink: Drink }>(`/admin/drinks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  adminDrinkSetActive: (id: string, isActive: boolean) =>
    request<{ drink: Drink }>(`/admin/drinks/${id}/active`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    }),
  // Member: eigenes Trinkjournal (Hero/Strip/30-Tage/Achievements, sortenagnostisch)
  journal: () => request<Journal>('/journal'),
  // Member: eigene Transaktions-Historie (chronologisch, mit Drink/Storno-Flag)
  meineTransaktionen: () => request<MeineHistorie>('/me/transaktionen'),
  // Member: nur aktive Drinks zum Buchen
  drinks: () => request<{ drinks: Drink[] }>('/drinks'),
  // Member: Drink kaufen → liefert Transaktion + neues Live-Guthaben zurück
  buchen: (drinkId: string) =>
    request<{ transaktion: Transaktion; guthabenCent: number }>('/transaktionen/kauf', {
      method: 'POST',
      body: JSON.stringify({ drinkId }),
    }),
  // Storno einer eigenen Transaktion (Mitglied: nur eigene KAUF im 5-Min-Fenster,
  // Auto-Notiz vom Backend; Admin: jederzeit alles, Pflicht-Notiz im Body).
  storno: (transaktionId: string, notiz?: string) =>
    request<{
      transaktion: Transaktion;
      kassenGegenbuchung: KassenTransaktion | null;
      guthabenCent: number;
    }>(`/transaktionen/${transaktionId}/storno`, {
      method: 'POST',
      body: JSON.stringify(notiz ? { notiz } : {}),
    }),
  // Admin: Mitglieder für Auswahl (z.B. Bargeld-Aufladung). Default nur aktive;
  // includeInactive=true liefert auch deaktivierte (für Sichtbarkeit + Reaktivierung).
  adminUsers: (includeInactive = false) =>
    request<{ users: AdminUser[] }>(`/admin/users${includeInactive ? '?includeInactive=true' : ''}`),
  // Admin: deaktiviertes Konto wieder aktivieren (Soft-Delete rückgängig)
  adminReactivateUser: (id: string) =>
    request<{ ok: true; user: { id: string; firstName: string; lastName: string; isAdmin: boolean; isLeitung: boolean; isActive: boolean } }>(
      `/admin/users/${id}/reactivate`,
      { method: 'PATCH' },
    ),
  // Admin: Mitglied-Detail (Stammdaten + Live-Saldo + Transaktionshistorie)
  adminUserDetail: (id: string) =>
    request<{ user: AdminUserDetail; transaktionen: DetailTransaktion[] }>(`/admin/users/${id}`),
  // Admin: manuelle Guthaben-Korrektur (nur Mitglieder-Transaktion) → neuer Saldo
  adminKorrektur: (input: { userId: string; betragCent: number; notiz: string }) =>
    request<{ transaktion: Transaktion; guthabenCent: number }>('/admin/korrektur', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  // Admin: Mitglied entfernen (Soft-Delete) — warnt bei nicht-ausgeglichenem Topf
  adminDeleteUser: (id: string) =>
    request<{ ok: true; warnung: string | null }>(`/admin/users/${id}`, { method: 'DELETE' }),
  // Member: eigenes Konto löschen (Soft-Delete) → danach ausgeloggt
  deleteMe: () => request<{ ok: true }>('/me', { method: 'DELETE' }),
  // Admin-exklusiver Datenexport (§9). Mitglieder exportieren nicht mehr selbst.
  // Einzeln: Daten EINES Mitglieds; Gesamt: alle aktiven User + Kasse + Drinks.
  adminUserExport: (id: string) => request<unknown>(`/admin/users/${id}/export`),
  adminGesamtExport: () => request<unknown>('/admin/export'),
  // Admin: Leitung-Recht vergeben/entziehen (nur isLeitung, nicht isAdmin)
  adminSetLeitung: (id: string, isLeitung: boolean) =>
    request<{ user: { id: string; firstName: string; lastName: string; isAdmin: boolean; isLeitung: boolean } }>(
      `/admin/users/${id}/leitung`,
      { method: 'PATCH', body: JSON.stringify({ isLeitung }) },
    ),
  // Admin: Verwalter-Recht (isAdmin) vergeben/entziehen (Letzter-Admin-Schutz im Backend)
  adminSetAdmin: (id: string, isAdmin: boolean) =>
    request<{ user: { id: string; firstName: string; lastName: string; isAdmin: boolean; isLeitung: boolean } }>(
      `/admin/users/${id}/admin`,
      { method: 'PATCH', body: JSON.stringify({ isAdmin }) },
    ),
  // Verwalter: eigenes Profil pflegen — paypal.me-Link und/oder WhatsApp-Nummer.
  // Nur mitgeschickte Felder werden geändert (undefined = unangetastet, null = leeren).
  setMyProfil: (input: { paypalMeLink?: string | null; whatsappNummer?: string | null }) =>
    request<{ user: { id: string; paypalMeLink: string | null; whatsappNummer: string | null } }>(
      '/admin/me/paypal',
      { method: 'PATCH', body: JSON.stringify(input) },
    ),
  // Admin ODER Leitung: Sortenstatistik (anonym aggregiert)
  sortenStatistik: (zeitraum: StatistikZeitraum) =>
    request<SortenStatistik>(`/statistik/sorten?zeitraum=${zeitraum}`),
  // Admin ODER Leitung: Kassen-Kennzahlen (Töpfe, Box, Vermögen, Deckung)
  adminKasseSummary: () => request<KassenSummary>('/admin/kasse/summary'),
  // Admin: Kassen-Historie (alle Bewegungen chronologisch)
  adminKasseHistorie: () =>
    request<{ buchungen: KassenHistorieEintrag[] }>('/admin/kasse/historie'),
  // Admin: einzeilige Kassen-Buchung (EINKAUF/ENTNAHME/SPENDE/KORREKTUR)
  adminKasseBuchung: (input: {
    typ: KassenBuchungTyp;
    konto: KassenKonto;
    betragCent: number;
    vermerk: string;
  }) =>
    request<{ kassenTransaktion: KassenTransaktion }>('/admin/kasse/buchung', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  // Admin: Einlage in die Box (zweizeilig gekoppelt)
  adminKasseEinlage: (input: { betragCent: number; vermerk: string }) =>
    request<{ verwalterZeile: KassenTransaktion; boxZeile: KassenTransaktion }>(
      '/admin/kasse/einlage',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  // Admin: Bargeld-Aufladung — erzeugt gekoppelte Mitglieder- und Kassen-Buchung.
  // konto wählt das Kassen-Konto der gekoppelten EINZAHLUNG (Verwalter-Topf oder
  // Bar-Vereinskasse/Box). Default VERWALTER, wenn weggelassen.
  adminAufladungBargeld: (input: { userId: string; betragCent: number; vermerk: string; konto?: KassenKonto }) =>
    request<{
      transaktion: Transaktion;
      kassenTransaktion: KassenTransaktion;
      guthabenCent: number;
    }>('/admin/aufladung/bargeld', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  // Admin: DIREKTE Einzahlung (Bündel 3) — Methode BAR (Topf/Box-Wahl) oder PAYPAL
  // (immer auf den Topf des eintragenden Admins). Bucht gekoppelt; ohne Anfrage.
  adminAufladungEinzahlung: (input: {
    userId: string;
    betragCent: number;
    vermerk: string;
    methode: EinzahlungMethode;
    konto?: KassenKonto;
  }) =>
    request<{
      transaktion: Transaktion;
      kassenTransaktion: KassenTransaktion;
      guthabenCent: number;
    }>('/admin/aufladung/einzahlung', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  // Admin: eine Kassen-Buchung stornieren (Gegenbuchung; gekoppelte EINZAHLUNG zieht
  // die Mitglieder-Seite mit). Pflicht-Notiz. guthabenCent != null nur bei gekoppelt.
  adminKasseStorno: (id: string, notiz: string) =>
    request<{
      storno: KassenTransaktion;
      mitgliedStorno: Transaktion | null;
      guthabenCent: number | null;
    }>(`/admin/kasse/buchung/${id}/storno`, {
      method: 'POST',
      body: JSON.stringify({ notiz }),
    }),

  // Mitglied: zuständigen Verwalter (Name + paypal.me-Link + WhatsApp) für den
  // Aufladen-Tab. Bündel 5: einziger verbliebener Member-Aufladen-Endpoint — das
  // Mitglied überweist direkt per paypal.me und gibt dem Verwalter per WhatsApp
  // Bescheid; der Verwalter bucht admin-direkt (kein Anfrage-Absenden mehr).
  aufladungZustaendigerVerwalter: () =>
    request<{ verwalter: VerwalterPublic | null }>('/aufladung/zustaendiger-verwalter'),
};

// Löst einen Browser-Download einer JSON-Datei aus (Blob-Muster aus Account-A).
// Gemeinsam genutzt von den Admin-Exporten (Einzel-Mitglied + Gesamt).
export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// paypal.me-Link OHNE Betrag (PayPal-Umbau): https://paypal.me/{link}. Das
// Mitglied gibt den Betrag selbst in PayPal ein.
export function paypalMeUrlOhneBetrag(link: string): string {
  return `https://paypal.me/${link}`;
}

// wa.me-Deep-Link mit vorgefülltem Text: https://wa.me/{ziffern}?text=...
// Nummer kommt bereits ziffern-normalisiert vom Backend; defensiv hier nochmal.
export function waMeUrl(nummer: string, text: string): string {
  const ziffern = nummer.replace(/\D/g, '');
  return `https://wa.me/${ziffern}?text=${encodeURIComponent(text)}`;
}

export function formatGuthaben(cent: number): string {
  const sign = cent < 0 ? '− ' : '';
  const abs = Math.abs(cent);
  return sign + (abs / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

// Gebindegröße in ml → deutsche Liter-Anzeige: 500→"0,5 l", 330→"0,33 l", 1000→"1 l".
// SPIEGEL der kanonischen Backend-Funktion (backend/src/domain/drink-anzeige.ts),
// die dort unit-getestet ist — Logik 1:1 identisch halten (ICU-unabhängig).
export function formatVolumen(ml: number): string {
  const liter = ml / 1000;
  let s = liter.toFixed(2);
  s = s.replace(/\.?0+$/, '');
  s = s.replace('.', ',');
  return `${s} l`;
}

// Subzeile „Marke · Größe" — nur vorhandene Teile, mit " · " verbunden; null wenn
// beides leer (dann keine Subzeile rendern). Konsistent in Buchen + Admin-Katalog.
export function drinkSubzeile(d: { marke?: string | null; volumenMl?: number | null }): string | null {
  const parts: string[] = [];
  const marke = d.marke?.trim();
  if (marke) parts.push(marke);
  if (d.volumenMl != null) parts.push(formatVolumen(d.volumenMl));
  return parts.length ? parts.join(' · ') : null;
}

// Deutsch-korrekte alphabetische Drink-Sortierung (Umlaute, Groß/Klein egal).
// Frontend-seitig, weil SQLite-`name asc` keinen Locale-Vergleich macht.
export function compareDrinkName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name, 'de', { sensitivity: 'base' });
}
