'use client';

import { useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import type { GroupInvite } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface InviteManagerProps {
  groupId: string;
  initialInvites: GroupInvite[];
}

export function InviteManager({ groupId, initialInvites }: InviteManagerProps) {
  const [invites, setInvites] = useState(initialInvites);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const invite = await apiFetch<GroupInvite>(`/groups/${groupId}/invites`, {
        method: 'POST',
        body: JSON.stringify({ name, email }),
      });
      setInvites([invite, ...invites]);
      setName('');
      setEmail('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(inviteId: string) {
    await apiFetch(`/groups/${groupId}/invites/${inviteId}`, { method: 'DELETE' });
    setInvites(invites.filter((i) => i.id !== inviteId));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Invite by email</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="space-y-1">
            <Label htmlFor="invite-name">Name</Label>
            <Input id="invite-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? 'Inviting…' : 'Send invite'}
          </Button>
        </form>

        {invites.length > 0 && (
          <div className="space-y-1 border-t pt-4">
            <p className="text-sm font-medium">Pending invites</p>
            {invites.map((invite) => (
              <div key={invite.id} className="flex items-center justify-between text-sm">
                <span>
                  {invite.name} ({invite.email})
                </span>
                <Button variant="ghost" size="sm" onClick={() => handleCancel(invite.id)}>
                  Cancel
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
