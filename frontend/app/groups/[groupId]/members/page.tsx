import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { getServerAccessToken } from '@/lib/server-auth';
import type { Group, GroupMember } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function GroupMembersPage({ params }: { params: { groupId: string } }) {
  const accessToken = getServerAccessToken();
  if (!accessToken) {
    redirect('/login');
  }

  const [group, members] = await Promise.all([
    apiFetch<Group>(`/groups/${params.groupId}`, { accessToken }),
    apiFetch<GroupMember[]>(`/groups/${params.groupId}/members`, { accessToken }),
  ]);

  const inviteLink = `/join/${group.inviteCode}`;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Members of {group.name}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invite link</CardTitle>
        </CardHeader>
        <CardContent>
          <code className="break-all text-sm">{inviteLink}</code>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Members</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {members.map((m) => (
            <p key={m.id} className="text-sm">
              {m.user.name} {m.role === 'OWNER' && <span className="text-muted-foreground">(owner)</span>}
            </p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
