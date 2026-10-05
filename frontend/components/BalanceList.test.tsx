import { render, screen } from '@testing-library/react';
import { BalanceList } from './BalanceList';
import type { BalancesResponse } from '@/lib/types';

describe('BalanceList', () => {
  it('shows an empty state when there are no balances', () => {
    render(<BalanceList data={{ balances: [], simplifiedTransfers: [] }} currentUserId="me" />);
    expect(screen.getByText('No expenses yet.')).toBeInTheDocument();
  });

  it('labels the current user as "You" and formats positive/negative balances', () => {
    const data: BalancesResponse = {
      balances: [
        { userId: 'me', name: 'Me', netCents: 5000 },
        { userId: 'friend', name: 'Friend', netCents: -2500 },
      ],
      simplifiedTransfers: [],
    };

    render(<BalanceList data={data} currentUserId="me" />);

    expect(screen.getByText('You')).toBeInTheDocument();
    expect(screen.getByText('is owed ₹50.00')).toBeInTheDocument();
    expect(screen.getByText('Friend')).toBeInTheDocument();
    expect(screen.getByText('owes ₹25.00')).toBeInTheDocument();
  });

  it('shows "settled up" for a zero balance', () => {
    const data: BalancesResponse = {
      balances: [{ userId: 'me', name: 'Me', netCents: 0 }],
      simplifiedTransfers: [],
    };
    render(<BalanceList data={data} currentUserId="me" />);
    expect(screen.getByText('settled up')).toBeInTheDocument();
  });

  it('renders suggested settlements when present, resolving names from the balances list', () => {
    const data: BalancesResponse = {
      balances: [
        { userId: 'me', name: 'Me', netCents: -1000 },
        { userId: 'friend', name: 'Friend', netCents: 1000 },
      ],
      simplifiedTransfers: [{ fromUserId: 'me', toUserId: 'friend', amountCents: 1000 }],
    };
    render(<BalanceList data={data} currentUserId="me" />);
    expect(screen.getByText('You pay Friend ₹10.00')).toBeInTheDocument();
  });

  it('renders both party names when neither side is the current user', () => {
    const data: BalancesResponse = {
      balances: [
        { userId: 'alice', name: 'Alice', netCents: 500 },
        { userId: 'bob', name: 'Bob', netCents: -500 },
      ],
      simplifiedTransfers: [{ fromUserId: 'bob', toUserId: 'alice', amountCents: 500 }],
    };
    render(<BalanceList data={data} currentUserId="me" />);
    expect(screen.getByText('Bob pay Alice ₹5.00')).toBeInTheDocument();
  });

  it('falls back to "Unknown" for a balance entry with no name', () => {
    const data: BalancesResponse = {
      balances: [{ userId: 'ghost', name: null, netCents: 0 }],
      simplifiedTransfers: [],
    };
    render(<BalanceList data={data} currentUserId="me" />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });
});
