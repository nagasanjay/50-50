'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import type { Expense, GroupMember } from '@/lib/types';
import { ExpenseForm, type ExpenseFormValues } from '@/components/ExpenseForm';
import type { SplitMember, SplitParticipantsValue } from '@/components/SplitInput';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function toParticipantsValue(expense: Expense): SplitParticipantsValue {
  if (expense.splitType === 'EQUAL') {
    return { userIds: expense.participants.map((p) => p.userId) };
  }
  if (expense.splitType === 'PERCENTAGE') {
    return {
      shares: expense.participants.map((p) => ({ userId: p.userId, percentage: p.percentage ?? 0 })),
    };
  }
  return { shares: expense.participants.map((p) => ({ userId: p.userId, amountCents: p.shareCents })) };
}

export default function ExpenseDetailPage({
  params,
}: {
  params: { groupId: string; expenseId: string };
}) {
  const router = useRouter();
  const [members, setMembers] = useState<SplitMember[] | null>(null);
  const [expense, setExpense] = useState<Expense | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<GroupMember[]>(`/groups/${params.groupId}/members`),
      apiFetch<Expense>(`/groups/${params.groupId}/expenses/${params.expenseId}`),
    ])
      .then(([memberData, expenseData]) => {
        setMembers(memberData.map((m) => ({ userId: m.userId, name: m.user.name })));
        setExpense(expenseData);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load expense'));
  }, [params.groupId, params.expenseId]);

  async function handleSubmit(values: ExpenseFormValues) {
    setError(null);
    try {
      await apiFetch<Expense>(`/groups/${params.groupId}/expenses/${params.expenseId}`, {
        method: 'PATCH',
        body: JSON.stringify(values),
      });
      router.push(`/groups/${params.groupId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    }
  }

  async function handleDelete() {
    setError(null);
    try {
      await apiFetch(`/groups/${params.groupId}/expenses/${params.expenseId}`, { method: 'DELETE' });
      router.push(`/groups/${params.groupId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit expense</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {members && expense ? (
          <>
            <ExpenseForm
              members={members}
              submitLabel="Save changes"
              initialValues={{
                description: expense.description,
                amountCents: expense.amountCents,
                splitType: expense.splitType,
                paidById: expense.paidById,
                participants: toParticipantsValue(expense),
              }}
              onSubmit={handleSubmit}
            />
            <Button variant="destructive" className="w-full" onClick={handleDelete}>
              Delete expense
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
      </CardContent>
    </Card>
  );
}
