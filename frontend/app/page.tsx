import { redirect } from 'next/navigation';
import { getServerAccessToken } from '@/lib/server-auth';

export default function RootPage() {
  const token = getServerAccessToken();
  redirect(token ? '/groups' : '/login');
}
