import { clearAccessToken, getAccessToken, setAccessToken } from './auth';

const BACKEND_INTERNAL_URL = process.env.BACKEND_INTERNAL_URL ?? 'http://backend:4000';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface ApiFetchOptions extends RequestInit {
  /** Pass explicitly when calling from a Server Component (read via next/headers cookies()). */
  accessToken?: string;
}

/** Exported for direct unit testing — avoids toggling jsdom's global `window` in tests. */
export function buildUrl(path: string, isServer: boolean): string {
  return isServer ? `${BACKEND_INTERNAL_URL}${path}` : `/api${path}`;
}

function resolveUrl(path: string): string {
  return buildUrl(path, typeof window === 'undefined');
}

async function rawFetch(path: string, token: string | null, options: RequestInit): Promise<Response> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(resolveUrl(path), { ...options, headers, credentials: 'include' });
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { accessToken: explicitToken, ...rest } = options;
  const token = explicitToken ?? getAccessToken();
  let res = await rawFetch(path, token, rest);

  if (res.status === 401 && !explicitToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      res = await rawFetch(path, refreshed, rest);
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message ?? 'Request failed');
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

export async function refreshAccessToken(): Promise<string | null> {
  const res = await fetch(resolveUrl('/auth/refresh'), {
    method: 'POST',
    credentials: 'include',
  });

  if (!res.ok) {
    clearAccessToken();
    return null;
  }

  const body = (await res.json()) as { accessToken: string };
  setAccessToken(body.accessToken);
  return body.accessToken;
}
