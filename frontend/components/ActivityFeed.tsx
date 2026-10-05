import type { ActivityLogEntry } from '@/lib/types';
import { formatCents } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface ActivityFeedProps {
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
    case 'SETTLEMENT_CREATED':
      return `${actor} recorded a settlement of ${formatCents(meta.amountCents as number)}`;
    default:
      return `${actor} did something`;
  }
}

export function ActivityFeed({ entries }: ActivityFeedProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {entries.length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}
        {entries.map((entry) => (
          <p key={entry.id} className="text-sm">
            {describeEntry(entry)}
          </p>
        ))}
      </CardContent>
    </Card>
  );
}
