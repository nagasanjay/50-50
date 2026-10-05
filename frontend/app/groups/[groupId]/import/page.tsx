'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { GroupMember } from '@/lib/types';
import type { SplitMember } from '@/components/SplitInput';
import { ImportWizard } from '@/components/ImportWizard';

export default function ImportPage({ params }: { params: { groupId: string } }) {
  const [members, setMembers] = useState<SplitMember[] | null>(null);

  useEffect(() => {
    apiFetch<GroupMember[]>(`/groups/${params.groupId}/members`).then((data) =>
      setMembers(data.map((m) => ({ userId: m.userId, name: m.user.name }))),
    );
  }, [params.groupId]);

  if (!members) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return <ImportWizard groupId={params.groupId} members={members} />;
}
