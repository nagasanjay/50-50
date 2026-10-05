import Link from 'next/link';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { getServerAccessToken } from '@/lib/server-auth';
import type { Group } from '@/lib/types';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default async function GroupsPage() {
  const accessToken = getServerAccessToken();
  if (!accessToken) {
    redirect('/login');
  }

  const groups = await apiFetch<Group[]>('/groups', { accessToken });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Your groups</h1>
        <Link href="/groups/new" className={cn(buttonVariants())}>
          New group
        </Link>
      </div>

      {groups.length === 0 && (
        <p className="text-sm text-muted-foreground">
          You&apos;re not in any groups yet. Create one to get started.
        </p>
      )}

      <div className="space-y-2">
        {groups.map((group) => (
          <Link key={group.id} href={`/groups/${group.id}`}>
            <Card className="hover:bg-muted/50">
              <CardHeader>
                <CardTitle className="text-base">{group.name}</CardTitle>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
