'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import type { Expense, GroupMember } from '@/lib/types';
import { ExpenseForm, type ExpenseFormValues } from '@/components/ExpenseForm';
import type { SplitMember } from '@/components/SplitInput';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function NewExpensePage({ params }: { params: { groupId: string } }) {
  const router = useRouter();
  const [members, setMembers] = useState<SplitMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<GroupMember[]>(`/groups/${params.groupId}/members`)
      .then((data) => setMembers(data.map((m) => ({ userId: m.userId, name: m.user.name }))))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load members'));
  }, [params.groupId]);

  async function handleSubmit(values: ExpenseFormValues) {
    setError(null);
    try {
      await apiFetch<Expense>(`/groups/${params.groupId}/expenses`, {
        method: 'POST',
        body: JSON.stringify(values),
      });
      router.push(`/groups/${params.groupId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add expense</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {members ? (
          <ExpenseForm members={members} submitLabel="Add expense" onSubmit={handleSubmit} />
        ) : (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
      </CardContent>
    </Card>
  );
}
