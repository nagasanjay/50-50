'use client';

import { useState } from 'react';
import type { SplitType } from '@/lib/types';
import { SplitInput, type SplitMember, type SplitParticipantsValue } from '@/components/SplitInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface ExpenseFormValues {
  description: string;
  amountCents: number;
  splitType: SplitType;
  paidById: string;
  participants: SplitParticipantsValue;
}

export interface ExpenseFormProps {
  members: SplitMember[];
  initialValues?: Partial<ExpenseFormValues>;
  submitLabel?: string;
  onSubmit: (values: ExpenseFormValues) => void | Promise<void>;
}

const emptyParticipantsFor = (splitType: SplitType): SplitParticipantsValue =>
  splitType === 'EQUAL' ? { userIds: [] } : { shares: [] };

export function ExpenseForm({ members, initialValues, submitLabel = 'Save', onSubmit }: ExpenseFormProps) {
  const [description, setDescription] = useState(initialValues?.description ?? '');
  const [amount, setAmount] = useState(
    initialValues?.amountCents ? (initialValues.amountCents / 100).toString() : '',
  );
  const [splitType, setSplitType] = useState<SplitType>(initialValues?.splitType ?? 'EQUAL');
  const [paidById, setPaidById] = useState(initialValues?.paidById ?? members[0]?.userId ?? '');
  const [participants, setParticipants] = useState<SplitParticipantsValue>(
    initialValues?.participants ?? emptyParticipantsFor(splitType),
  );
  const [submitting, setSubmitting] = useState(false);

  function handleSplitTypeChange(next: SplitType) {
    setSplitType(next);
    setParticipants(emptyParticipantsFor(next));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        description,
        amountCents: Math.round(parseFloat(amount || '0') * 100),
        splitType,
        paidById,
        participants,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="description">Description</Label>
        <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} required />
      </div>

      <div className="space-y-1">
        <Label htmlFor="amount">Amount (₹)</Label>
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
        <Label htmlFor="paidBy">Paid by</Label>
        <select
          id="paidBy"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={paidById}
          onChange={(e) => setPaidById(e.target.value)}
        >
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="splitType">Split type</Label>
        <select
          id="splitType"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={splitType}
          onChange={(e) => handleSplitTypeChange(e.target.value as SplitType)}
        >
          <option value="EQUAL">Equal</option>
          <option value="EXACT">Exact amounts</option>
          <option value="PERCENTAGE">Percentage</option>
        </select>
      </div>

      <SplitInput members={members} splitType={splitType} value={participants} onChange={setParticipants} />

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}
