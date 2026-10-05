'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';

export default function JoinGroupPage({ params }: { params: { inviteCode: string } }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    apiFetch<{ groupId: string }>('/groups/join', {
      method: 'POST',
      body: JSON.stringify({ inviteCode: params.inviteCode }),
    })
      .then((membership) => {
        if (!cancelled) {
          router.push(`/groups/${membership.groupId}`);
          router.refresh();
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Could not join this group');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [params.inviteCode, router]);

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  return <p className="text-sm text-muted-foreground">Joining group…</p>;
}
