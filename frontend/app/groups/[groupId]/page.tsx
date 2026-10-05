import Link from 'next/link';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { getServerAccessToken } from '@/lib/server-auth';
import type { ActivityLogEntry, BalancesResponse, Group, User } from '@/lib/types';
import { BalanceList } from '@/components/BalanceList';
import { ActivityFeed } from '@/components/ActivityFeed';
import { BackLink } from '@/components/BackLink';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default async function GroupDetailPage({ params }: { params: { groupId: string } }) {
  const accessToken = getServerAccessToken();
  if (!accessToken) {
    redirect('/login');
  }

  const [group, me, balances, activity] = await Promise.all([
    apiFetch<Group>(`/groups/${params.groupId}`, { accessToken }),
    apiFetch<User>('/users/me', { accessToken }),
    apiFetch<BalancesResponse>(`/groups/${params.groupId}/balances`, { accessToken }),
    apiFetch<ActivityLogEntry[]>(`/groups/${params.groupId}/activity`, { accessToken }),
  ]);

  return (
    <div className="space-y-4">
      <BackLink href="/groups" label="Back to groups" />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{group.name}</h1>
        <div className="flex gap-2">
          <Link href={`/groups/${params.groupId}/members`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
            Members
          </Link>
          <Link href={`/groups/${params.groupId}/settle`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
            Settle up
          </Link>
          <Link href={`/groups/${params.groupId}/import`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
            Import from Splitwise
          </Link>
          <Link
            href={`/groups/${params.groupId}/expenses/new`}
            className={cn(buttonVariants({ size: 'sm' }))}
          >
            Add expense
          </Link>
        </div>
      </div>

      <BalanceList data={balances} currentUserId={me.id} />
      <ActivityFeed entries={activity} />
    </div>
  );
}
