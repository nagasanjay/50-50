'use client';

import { useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import type { GroupMember } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface AddMemberManagerProps {
  groupId: string;
  initialMembers: GroupMember[];
}

export function AddMemberManager({ groupId, initialMembers }: AddMemberManagerProps) {
  const [members, setMembers] = useState(initialMembers);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const pendingMembers = members.filter((m) => m.user.pending);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const member = await apiFetch<GroupMember>(`/groups/${groupId}/members`, {
        method: 'POST',
        body: JSON.stringify({ name, email }),
      });
      setMembers([...members, member]);
      setName('');
      setEmail('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(userId: string) {
    setError(null);
    try {
      await apiFetch(`/groups/${groupId}/members/${userId}`, { method: 'DELETE' });
      setMembers(members.filter((m) => m.userId !== userId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove this person');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add a person</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          They can be split into expenses right away. Once they register with this email, they
          get full access to the group.
        </p>
        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="space-y-1">
            <Label htmlFor="member-name">Name</Label>
            <Input id="member-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="member-email">Email</Label>
            <Input
              id="member-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? 'Adding…' : 'Add person'}
          </Button>
        </form>

        {pendingMembers.length > 0 && (
          <div className="space-y-1 border-t pt-4">
            <p className="text-sm font-medium">Not yet registered</p>
            {pendingMembers.map((member) => (
              <div key={member.id} className="flex items-center justify-between text-sm">
                <span>
                  {member.user.name} ({member.user.email})
                </span>
                <Button variant="ghost" size="sm" onClick={() => handleRemove(member.userId)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
