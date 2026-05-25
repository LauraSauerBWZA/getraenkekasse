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
};

export function formatGuthaben(cent: number): string {
  const sign = cent < 0 ? '− ' : '';
  const abs = Math.abs(cent);
  return sign + (abs / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}
