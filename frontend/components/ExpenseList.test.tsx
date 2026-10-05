import { render, screen } from '@testing-library/react';
import { ExpenseList } from './ExpenseList';
import type { Expense, GroupMember } from '@/lib/types';

const members: GroupMember[] = [
  {
    id: 'm1',
    groupId: 'g1',
    userId: 'me',
    role: 'OWNER',
    user: { id: 'me', name: 'Me', email: 'me@example.com', pending: false },
  },
  {
    id: 'm2',
    groupId: 'g1',
    userId: 'friend',
    role: 'MEMBER',
    user: { id: 'friend', name: 'Friend', email: 'friend@example.com', pending: false },
  },
];

function makeExpense(overrides: Partial<Expense>): Expense {
  return {
    id: 'e1',
    groupId: 'g1',
    description: 'Lunch',
    category: null,
    amountCents: 4000,
    splitType: 'EQUAL',
    paidById: 'friend',
    incurredAt: '2023-12-04T00:00:00.000Z',
    participants: [
      { id: 'p1', userId: 'me', shareCents: 2000, percentage: null },
      { id: 'p2', userId: 'friend', shareCents: 2000, percentage: null },
    ],
    ...overrides,
  };
}

describe('ExpenseList', () => {
  it('shows an empty state when there are no expenses', () => {
    render(<ExpenseList groupId="g1" expenses={[]} members={members} currentUserId="me" />);
    expect(screen.getByText('No expenses yet.')).toBeInTheDocument();
  });

  it('groups expenses by month and shows what the current user borrowed', () => {
    render(
      <ExpenseList groupId="g1" expenses={[makeExpense({})]} members={members} currentUserId="me" />,
    );

    expect(screen.getByText('December 2023')).toBeInTheDocument();
    expect(screen.getByText('Lunch')).toBeInTheDocument();
    expect(screen.getByText(/Friend paid/)).toBeInTheDocument();
    expect(screen.getByText('you borrowed')).toBeInTheDocument();
    expect(screen.getByText('₹20.00')).toBeInTheDocument();
  });

  it('shows what the current user lent when they paid for someone else', () => {
    const expense = makeExpense({ paidById: 'me' });
    render(<ExpenseList groupId="g1" expenses={[expense]} members={members} currentUserId="me" />);

    expect(screen.getByText(/You paid/)).toBeInTheDocument();
    expect(screen.getByText('you lent')).toBeInTheDocument();
    expect(screen.getByText('₹20.00')).toBeInTheDocument();
  });

  it('shows "not involved" when the current user has no stake in the expense', () => {
    const expense = makeExpense({
      paidById: 'friend',
      participants: [{ id: 'p2', userId: 'friend', shareCents: 4000, percentage: null }],
    });
    render(<ExpenseList groupId="g1" expenses={[expense]} members={members} currentUserId="me" />);

    expect(screen.getByText('not involved')).toBeInTheDocument();
  });

  it('links each row to the expense detail page', () => {
    render(
      <ExpenseList groupId="g1" expenses={[makeExpense({})]} members={members} currentUserId="me" />,
    );
    expect(screen.getByRole('link')).toHaveAttribute('href', '/groups/g1/expenses/e1');
  });
});
