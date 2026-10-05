import Link from 'next/link';
import { Receipt } from 'lucide-react';
import type { Expense, GroupMember } from '@/lib/types';
import { formatCents } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface ExpenseListProps {
  groupId: string;
  expenses: Expense[];
  members: GroupMember[];
  currentUserId: string;
}

interface MonthGroup {
  label: string;
  items: Expense[];
}

function groupByMonth(expenses: Expense[]): MonthGroup[] {
  const groups = new Map<string, Expense[]>();
  for (const expense of expenses) {
    const label = new Date(expense.incurredAt).toLocaleDateString('en-IN', {
      month: 'long',
      year: 'numeric',
    });
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(expense);
  }
  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

function dayBadge(incurredAt: string): string {
  return new Date(incurredAt).toLocaleDateString('en-IN', { month: 'short', day: '2-digit' });
}

export function ExpenseList({ groupId, expenses, members, currentUserId }: ExpenseListProps) {
  const nameById = new Map(members.map((m) => [m.userId, m.user.name]));
  const nameFor = (userId: string) => nameById.get(userId) ?? 'Unknown';
  const groups = groupByMonth(expenses);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Expenses</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {expenses.length === 0 && <p className="text-sm text-muted-foreground">No expenses yet.</p>}
        {groups.map((group) => (
          <div key={group.label} className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{group.label}</p>
            {group.items.map((expense) => {
              const myShare = expense.participants.find((p) => p.userId === currentUserId)?.shareCents ?? 0;
              const iPaid = expense.paidById === currentUserId ? expense.amountCents : 0;
              const net = iPaid - myShare;
              const involved = expense.paidById === currentUserId || myShare > 0;
              const payerLabel =
                expense.paidById === currentUserId ? 'You paid' : `${nameFor(expense.paidById)} paid`;

              return (
                <Link
                  key={expense.id}
                  href={`/groups/${groupId}/expenses/${expense.id}`}
                  className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted"
                >
                  <div className="flex w-12 shrink-0 flex-col items-center text-xs text-muted-foreground">
                    {dayBadge(expense.incurredAt)}
                  </div>
                  <Receipt className="h-8 w-8 shrink-0 rounded-md bg-muted p-1.5 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{expense.description}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {payerLabel} {formatCents(expense.amountCents)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {!involved ? (
                      <span className="text-xs text-muted-foreground">not involved</span>
                    ) : net > 0 ? (
                      <>
                        <p className="text-xs text-muted-foreground">you lent</p>
                        <p className="text-green-600">{formatCents(net)}</p>
                      </>
                    ) : net < 0 ? (
                      <>
                        <p className="text-xs text-muted-foreground">you borrowed</p>
                        <p className="text-destructive">{formatCents(-net)}</p>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">settled</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
