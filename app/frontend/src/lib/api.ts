const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export interface ApiUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  guthabenCent: number;
  isAdmin: boolean;
  isLeitung: boolean;
  paypalMeLink: string | null;
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
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DrinkInput {
  name: string;
  preisCent: number;
  icon?: string;
  kategorie: DrinkKategorie;
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

export const AUFLADUNGS_STATUS = ['OFFEN', 'BESTAETIGT', 'ABGELEHNT'] as const;
export type AufladungsStatus = (typeof AUFLADUNGS_STATUS)[number];

// Öffentliche Verwalter-Sicht (kein passwordHash o.ä.), wie vom Backend geliefert.
export interface VerwalterPublic {
  id: string;
  firstName: string;
  lastName: string;
  paypalMeLink: string | null;
}

export interface AufladungsAnfrage {
  id: string;
  userId: string;
  betragCent: number;
  status: AufladungsStatus;
  zugewiesenerVerwalterId: string;
  requestedAt: string;
  decidedAt: string | null;
  decidedById: string | null;
  adminNotiz: string | null;
  transaktionId: string | null;
}

// /aufladung/meine liefert die eigene Anfrage inkl. zugewiesenem Verwalter.
export interface MeineAnfrage extends AufladungsAnfrage {
  zugewiesenerVerwalter: VerwalterPublic;
}

// Admin-Liste liefert die Anfrage inkl. Mitglied-Daten.
export interface AdminAnfrage extends AufladungsAnfrage {
  user: { id: string; firstName: string; lastName: string; email: string };
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
  createdAt: string;
}

// Einzeilige Kassen-Aktionen (EINLAGE_BOX hat einen eigenen Endpoint).
export type KassenBuchungTyp = 'EINKAUF' | 'ENTNAHME' | 'SPENDE' | 'KORREKTUR';
export type KassenKonto = 'VERWALTER' | 'BOX';

// Sortenstatistik (B3) — app-weit anonym aggregiert.
export type StatistikZeitraum = 'woche' | 'monat' | 'quartal';

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
  adminInvite: (input: { email: string; firstName: string; lastName: string }) =>
    request<{
      user: { id: string; email: string; firstName: string; lastName: string };
      devToken?: string;
    }>('/admin/invite', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  adminInvites: () => request<{ invites: AdminInvite[] }>('/admin/invites'),
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
  // Admin: aktive Mitglieder für Auswahl (z.B. Bargeld-Aufladung)
  adminUsers: () => request<{ users: AdminUser[] }>('/admin/users'),
  // Admin: Mitglied-Detail (Stammdaten + Live-Saldo + Transaktionshistorie)
  adminUserDetail: (id: string) =>
    request<{ user: AdminUserDetail; transaktionen: DetailTransaktion[] }>(`/admin/users/${id}`),
  // Admin: manuelle Guthaben-Korrektur (nur Mitglieder-Transaktion) → neuer Saldo
  adminKorrektur: (input: { userId: string; betragCent: number; notiz: string }) =>
    request<{ transaktion: Transaktion; guthabenCent: number }>('/admin/korrektur', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
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
  // Verwalter: eigenen paypal.me-Link setzen/leeren (null = leeren)
  setMyPaypalLink: (paypalMeLink: string | null) =>
    request<{ user: { id: string; paypalMeLink: string | null } }>('/admin/me/paypal', {
      method: 'PATCH',
      body: JSON.stringify({ paypalMeLink }),
    }),
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
  // Admin: Bargeld-Aufladung — erzeugt gekoppelte Mitglieder- und Kassen-Buchung
  adminAufladungBargeld: (input: { userId: string; betragCent: number; vermerk: string }) =>
    request<{
      transaktion: Transaktion;
      kassenTransaktion: KassenTransaktion;
      guthabenCent: number;
    }>('/admin/aufladung/bargeld', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  // Mitglied: zuständigen Verwalter (Name + paypal.me-Link) für den Aufladen-Tab
  aufladungZustaendigerVerwalter: () =>
    request<{ verwalter: VerwalterPublic | null }>('/aufladung/zustaendiger-verwalter'),
  // Mitglied: PayPal-Aufladungs-Anfrage stellen → offene Anfrage + Verwalter
  aufladungPaypal: (betragCent: number) =>
    request<{ anfrage: AufladungsAnfrage; verwalter: VerwalterPublic }>('/aufladung/paypal', {
      method: 'POST',
      body: JSON.stringify({ betragCent }),
    }),
  // Mitglied: eigene Anfragen (neueste zuerst) inkl. zugewiesenem Verwalter
  aufladungMeine: () => request<{ anfragen: MeineAnfrage[] }>('/aufladung/meine'),
  // Admin: offene PayPal-Anfragen
  adminAufladungAnfragen: () =>
    request<{ anfragen: AdminAnfrage[] }>('/admin/aufladung/anfragen'),
  // Admin: Anfrage bestätigen → gekoppelte Buchung + neues Mitglied-Guthaben
  adminAufladungBestaetigen: (id: string, adminNotiz?: string) =>
    request<{
      anfrage: AufladungsAnfrage;
      transaktion: Transaktion;
      kassenTransaktion: KassenTransaktion;
      guthabenCent: number;
    }>(`/admin/aufladung/anfragen/${id}/bestaetigen`, {
      method: 'POST',
      body: JSON.stringify(adminNotiz ? { adminNotiz } : {}),
    }),
  // Admin: Anfrage ablehnen (keine Buchung)
  adminAufladungAblehnen: (id: string, adminNotiz?: string) =>
    request<{ anfrage: AufladungsAnfrage }>(`/admin/aufladung/anfragen/${id}/ablehnen`, {
      method: 'POST',
      body: JSON.stringify(adminNotiz ? { adminNotiz } : {}),
    }),
};

// paypal.me-Deep-Link: https://paypal.me/{link}/{betrag} (KONFIGURATION §6.5).
// Betrag mit Punkt-Dezimaltrenner (paypal.me-Format), ganze Beträge ohne
// Nachkommastellen. Keine PayPal-API — nur der Link (§11).
export function paypalMeUrl(link: string, cent: number): string {
  const euro = cent / 100;
  const betrag = Number.isInteger(euro) ? String(euro) : euro.toFixed(2);
  return `https://paypal.me/${link}/${betrag}`;
}

export function formatGuthaben(cent: number): string {
  const sign = cent < 0 ? '− ' : '';
  const abs = Math.abs(cent);
  return sign + (abs / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}
