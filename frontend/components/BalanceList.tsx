import type { BalancesResponse } from '@/lib/types';
import { formatCents } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface BalanceListProps {
  data: BalancesResponse;
  currentUserId: string;
}

export function BalanceList({ data, currentUserId }: BalanceListProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Balances</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.balances.length === 0 && (
            <p className="text-sm text-muted-foreground">No expenses yet.</p>
          )}
          {data.balances.map((b) => (
            <div key={b.userId} className="flex items-center justify-between text-sm">
              <span>{b.userId === currentUserId ? 'You' : (b.name ?? 'Unknown')}</span>
              {b.netCents === 0 ? (
                <span className="text-muted-foreground">settled up</span>
              ) : b.netCents > 0 ? (
                <span className="text-green-600">is owed {formatCents(b.netCents)}</span>
              ) : (
                <span className="text-destructive">owes {formatCents(-b.netCents)}</span>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {data.simplifiedTransfers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Suggested settlements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {data.simplifiedTransfers.map((t, i) => (
              <p key={i} className="text-sm">
                {t.fromUserId === currentUserId ? 'You' : t.fromUserId} pay{' '}
                {t.toUserId === currentUserId ? 'you' : t.toUserId} {formatCents(t.amountCents)}
              </p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
