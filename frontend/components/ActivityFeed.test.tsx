import { render, screen } from '@testing-library/react';
import { ActivityFeed } from './ActivityFeed';
import type { ActivityLogEntry } from '@/lib/types';

function makeEntry(overrides: Partial<ActivityLogEntry>): ActivityLogEntry {
  return {
    id: '1',
    groupId: 'g1',
    actorId: 'u1',
    type: 'GROUP_CREATED',
    metadata: {},
    createdAt: new Date().toISOString(),
    actor: { id: 'u1', name: 'Alice' },
    ...overrides,
  };
}

describe('ActivityFeed', () => {
  it('shows an empty state when there is no activity', () => {
    render(<ActivityFeed entries={[]} />);
    expect(screen.getByText('No activity yet.')).toBeInTheDocument();
  });

  it('describes each activity type in plain language', () => {
    const entries: ActivityLogEntry[] = [
      makeEntry({ id: '1', type: 'GROUP_CREATED' }),
      makeEntry({ id: '2', type: 'MEMBER_JOINED', actor: { id: 'u2', name: 'Bob' } }),
      makeEntry({
        id: '3',
        type: 'EXPENSE_CREATED',
        metadata: { description: 'Hotel', amountCents: 5000 },
      }),
      makeEntry({
        id: '4',
        type: 'SETTLEMENT_CREATED',
        metadata: { amountCents: 2500 },
      }),
      makeEntry({ id: '5', type: 'EXPENSE_UPDATED', metadata: { description: 'Hotel' } }),
      makeEntry({ id: '6', type: 'EXPENSE_DELETED', metadata: { description: 'Snacks' } }),
    ];

    render(<ActivityFeed entries={entries} />);

    expect(screen.getByText('Alice created the group')).toBeInTheDocument();
    expect(screen.getByText('Bob joined the group')).toBeInTheDocument();
    expect(screen.getByText('Alice added "Hotel" (₹50.00)')).toBeInTheDocument();
    expect(screen.getByText('Alice recorded a settlement of ₹25.00')).toBeInTheDocument();
    expect(screen.getByText('Alice updated "Hotel"')).toBeInTheDocument();
    expect(screen.getByText('Alice deleted "Snacks"')).toBeInTheDocument();
  });

  it('falls back to a generic description for an unrecognized activity type', () => {
    const entry = makeEntry({ type: 'SOMETHING_NEW' as never });
    render(<ActivityFeed entries={[entry]} />);
    expect(screen.getByText('Alice did something')).toBeInTheDocument();
  });

  it('falls back to "Someone" when the actor is missing', () => {
    const entry = makeEntry({ actor: undefined as never });
    render(<ActivityFeed entries={[entry]} />);
    expect(screen.getByText('Someone created the group')).toBeInTheDocument();
  });
});
