'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import type { GroupMember, Settlement } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function SettleUpPage({ params }: { params: { groupId: string } }) {
  const router = useRouter();
  const [members, setMembers] = useState<GroupMember[] | null>(null);
  const [fromUserId, setFromUserId] = useState('');
  const [toUserId, setToUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiFetch<GroupMember[]>(`/groups/${params.groupId}/members`).then((data) => {
      setMembers(data);
      setFromUserId(data[0]?.userId ?? '');
      setToUserId(data[1]?.userId ?? data[0]?.userId ?? '');
    });
  }, [params.groupId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch<Settlement>(`/groups/${params.groupId}/settlements`, {
        method: 'POST',
        body: JSON.stringify({
          fromUserId,
          toUserId,
          amountCents: Math.round(parseFloat(amount || '0') * 100),
          note: note || undefined,
        }),
      });
      router.push(`/groups/${params.groupId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Settle up</CardTitle>
      </CardHeader>
      <CardContent>
        {!members ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="from">Who paid</Label>
              <select
                id="from"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={fromUserId}
                onChange={(e) => setFromUserId(e.target.value)}
              >
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.user.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="to">Who received</Label>
              <select
                id="to"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={toUserId}
                onChange={(e) => setToUserId(e.target.value)}
              >
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.user.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="amount">Amount ($)</Label>
              <Input
                id="amount"
                type="number"
                min={0.01}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="note">Note (optional)</Label>
              <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? 'Recording…' : 'Record settlement'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
