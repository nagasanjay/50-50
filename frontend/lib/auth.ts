const ACCESS_TOKEN_COOKIE = 'access_token';
const ACCESS_TOKEN_MAX_AGE_SECONDS = 15 * 60;

export function setAccessToken(token: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${ACCESS_TOKEN_COOKIE}=${encodeURIComponent(token)}; path=/; samesite=lax; max-age=${ACCESS_TOKEN_MAX_AGE_SECONDS}`;
}

export function getAccessToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${ACCESS_TOKEN_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function clearAccessToken(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${ACCESS_TOKEN_COOKIE}=; path=/; max-age=0`;
}
