const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export interface ApiUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  guthabenCent: number;
  isAdmin: boolean;
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
};

export function formatGuthaben(cent: number): string {
  const sign = cent < 0 ? '− ' : '';
  const abs = Math.abs(cent);
  return sign + (abs / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}
