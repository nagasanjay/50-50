import { cookies } from 'next/headers';

export function getServerAccessToken(): string | undefined {
  return cookies().get('access_token')?.value;
}
