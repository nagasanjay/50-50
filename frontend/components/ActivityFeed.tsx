'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import type { ActivityLogEntry } from '@/lib/types';
import { formatCents } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface ActivityFeedProps {
  groupId: string;
  entries: ActivityLogEntry[];
}

function describeEntry(entry: ActivityLogEntry): string {
  const actor = entry.actor?.name ?? 'Someone';
  const meta = entry.metadata as Record<string, unknown>;

  switch (entry.type) {
    case 'GROUP_CREATED':
      return `${actor} created the group`;
    case 'MEMBER_JOINED':
      return `${actor} joined the group`;
    case 'EXPENSE_CREATED':
      return `${actor} added "${meta.description}" (${formatCents(meta.amountCents as number)})`;
    case 'EXPENSE_UPDATED':
      return `${actor} updated "${meta.description}"`;
    case 'EXPENSE_DELETED':
      return `${actor} deleted "${meta.description}"`;
    case 'SETTLEMENT_CREATED': {
      const note = meta.note as string | null | undefined;
      const base = `${actor} recorded a settlement of ${formatCents(meta.amountCents as number)}`;
      return note ? `${base} (${note})` : base;
    }
    default:
      return `${actor} did something`;
  }
}

function markDeleted(entries: ActivityLogEntry[], predicate: (e: ActivityLogEntry) => boolean) {
  return entries.map((e) =>
    predicate(e) ? { ...e, metadata: { ...(e.metadata as Record<string, unknown>), deleted: true } } : e,
  );
}

export function ActivityFeed({ groupId, entries: initialEntries }: ActivityFeedProps) {
  const [entries, setEntries] = useState(initialEntries);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function handleDeleteExpense(entryId: string, expenseId: string) {
    setPendingId(entryId);
    try {
      await apiFetch(`/groups/${groupId}/expenses/${expenseId}`, { method: 'DELETE' });
      setEntries((prev) =>
        markDeleted(
          prev,
          (e) =>
            (e.type === 'EXPENSE_CREATED' || e.type === 'EXPENSE_UPDATED') &&
            (e.metadata as Record<string, unknown>).expenseId === expenseId,
        ),
      );
    } finally {
      setPendingId(null);
    }
  }

  async function handleDeleteSettlement(entryId: string, settlementId: string) {
    setPendingId(entryId);
    try {
      await apiFetch(`/groups/${groupId}/settlements/${settlementId}`, { method: 'DELETE' });
      setEntries((prev) =>
        markDeleted(
          prev,
          (e) =>
            e.type === 'SETTLEMENT_CREATED' &&
            (e.metadata as Record<string, unknown>).settlementId === settlementId,
        ),
      );
    } finally {
      setPendingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {entries.length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}
        {entries.map((entry) => {
          const meta = entry.metadata as Record<string, unknown>;
          const deleted = meta.deleted === true;
          const expenseId =
            entry.type === 'EXPENSE_CREATED' || entry.type === 'EXPENSE_UPDATED'
              ? (meta.expenseId as string | undefined)
              : undefined;
          const settlementId =
            entry.type === 'SETTLEMENT_CREATED' ? (meta.settlementId as string | undefined) : undefined;

          return (
            <div key={entry.id} className="flex items-center justify-between gap-2 text-sm">
              <span className={deleted ? 'text-muted-foreground line-through' : undefined}>
                {describeEntry(entry)}
              </span>
              {deleted && <span className="shrink-0 text-xs text-muted-foreground">deleted</span>}
              {!deleted && expenseId && (
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/groups/${groupId}/expenses/${expenseId}`}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Edit
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 text-xs text-destructive hover:text-destructive"
                    disabled={pendingId === entry.id}
                    onClick={() => handleDeleteExpense(entry.id, expenseId)}
                  >
                    Delete
                  </Button>
                </div>
              )}
              {!deleted && settlementId && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto shrink-0 p-0 text-xs text-destructive hover:text-destructive"
                  disabled={pendingId === entry.id}
                  onClick={() => handleDeleteSettlement(entry.id, settlementId)}
                >
                  Delete
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
