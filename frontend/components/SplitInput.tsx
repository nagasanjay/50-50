'use client';

import type { SplitType } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface SplitMember {
  userId: string;
  name: string;
}

export type SplitParticipantsValue =
  | { userIds: string[] }
  | { shares: { userId: string; amountCents: number }[] }
  | { shares: { userId: string; percentage: number }[] };

export interface SplitInputProps {
  members: SplitMember[];
  splitType: SplitType;
  value: SplitParticipantsValue;
  onChange: (value: SplitParticipantsValue) => void;
}

export function SplitInput({ members, splitType, value, onChange }: SplitInputProps) {
  if (splitType === 'EQUAL') {
    const userIds = 'userIds' in value ? value.userIds : [];
    return (
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Split equally between</legend>
        {members.map((m) => (
          <label key={m.userId} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={userIds.includes(m.userId)}
              onChange={(e) => {
                const next = e.target.checked
                  ? [...userIds, m.userId]
                  : userIds.filter((id) => id !== m.userId);
                onChange({ userIds: next });
              }}
            />
            {m.name}
          </label>
        ))}
      </fieldset>
    );
  }

  const isPercentage = splitType === 'PERCENTAGE';
  const shares = 'shares' in value ? value.shares : [];
  const shareFor = (userId: string) => shares.find((s) => s.userId === userId);

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">
        {isPercentage ? 'Percentage per person' : 'Exact amount per person ($)'}
      </legend>
      {members.map((m) => {
        const existing = shareFor(m.userId);
        const rawValue = existing
          ? isPercentage
            ? (existing as { percentage: number }).percentage
            : (existing as { amountCents: number }).amountCents / 100
          : '';
        return (
          <div key={m.userId} className="flex items-center gap-2">
            <Label className="w-24 shrink-0">{m.name}</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={rawValue}
              onChange={(e) => {
                const num = parseFloat(e.target.value);
                const safeNum = Number.isFinite(num) ? num : 0;
                const rest = shares.filter((s) => s.userId !== m.userId);
                const updated = isPercentage
                  ? { userId: m.userId, percentage: safeNum }
                  : { userId: m.userId, amountCents: Math.round(safeNum * 100) };
                onChange({ shares: [...rest, updated] } as SplitParticipantsValue);
              }}
            />
          </div>
        );
      })}
    </fieldset>
  );
}
