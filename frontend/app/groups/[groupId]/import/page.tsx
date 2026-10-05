'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { GroupMember } from '@/lib/types';
import type { SplitMember } from '@/components/SplitInput';
import { ImportWizard } from '@/components/ImportWizard';
import { BackLink } from '@/components/BackLink';

export default function ImportPage({ params }: { params: { groupId: string } }) {
  const [members, setMembers] = useState<SplitMember[] | null>(null);

  useEffect(() => {
    apiFetch<GroupMember[]>(`/groups/${params.groupId}/members`).then((data) =>
      setMembers(data.map((m) => ({ userId: m.userId, name: m.user.name }))),
    );
  }, [params.groupId]);

  return (
    <div className="space-y-4">
      <BackLink href={`/groups/${params.groupId}`} label="Back to group" />
      {!members ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <ImportWizard groupId={params.groupId} members={members} />
      )}
    </div>
  );
}
