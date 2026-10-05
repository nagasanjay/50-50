import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'status',
    json: async () => body,
  } as Response;
}

describe('ActivityFeed', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('shows an empty state when there is no activity', () => {
    render(<ActivityFeed groupId="g1" entries={[]} />);
    expect(screen.getByText('No activity yet.')).toBeInTheDocument();
  });

  it('describes each activity type in plain language', () => {
    const entries: ActivityLogEntry[] = [
      makeEntry({ id: '1', type: 'GROUP_CREATED' }),
      makeEntry({ id: '2', type: 'MEMBER_JOINED', actor: { id: 'u2', name: 'Bob' } }),
      makeEntry({
        id: '3',
        type: 'EXPENSE_CREATED',
        metadata: { expenseId: 'e1', description: 'Hotel', amountCents: 5000, deleted: false },
      }),
      makeEntry({
        id: '4',
        type: 'SETTLEMENT_CREATED',
        metadata: { settlementId: 's1', amountCents: 2500, deleted: false, note: 'Venmo' },
      }),
      makeEntry({ id: '5', type: 'EXPENSE_UPDATED', metadata: { description: 'Hotel' } }),
      makeEntry({ id: '6', type: 'EXPENSE_DELETED', metadata: { description: 'Snacks' } }),
    ];

    render(<ActivityFeed groupId="g1" entries={entries} />);

    expect(screen.getByText('Alice created the group')).toBeInTheDocument();
    expect(screen.getByText('Bob joined the group')).toBeInTheDocument();
    expect(screen.getByText('Alice added "Hotel" (₹50.00)')).toBeInTheDocument();
    expect(screen.getByText('Alice recorded a settlement of ₹25.00 (Venmo)')).toBeInTheDocument();
    expect(screen.getByText('Alice updated "Hotel"')).toBeInTheDocument();
    expect(screen.getByText('Alice deleted "Snacks"')).toBeInTheDocument();
  });

  it('falls back to a generic description for an unrecognized activity type', () => {
    const entry = makeEntry({ type: 'SOMETHING_NEW' as never });
    render(<ActivityFeed groupId="g1" entries={[entry]} />);
    expect(screen.getByText('Alice did something')).toBeInTheDocument();
  });

  it('falls back to "Someone" when the actor is missing', () => {
    const entry = makeEntry({ actor: undefined as never });
    render(<ActivityFeed groupId="g1" entries={[entry]} />);
    expect(screen.getByText('Someone created the group')).toBeInTheDocument();
  });

  it('shows Edit/Delete actions for a live expense entry, and deletes it on click', async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse(200, { success: true }));
    const entry = makeEntry({
      type: 'EXPENSE_CREATED',
      metadata: { expenseId: 'e1', description: 'Hotel', amountCents: 5000, deleted: false },
    });

    render(<ActivityFeed groupId="g1" entries={[entry]} />);

    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute(
      'href',
      '/groups/g1/expenses/e1',
    );

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/groups/g1/expenses/e1',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(await screen.findByText('deleted')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('hides actions and shows "deleted" for an already-deleted expense entry', () => {
    const entry = makeEntry({
      type: 'EXPENSE_CREATED',
      metadata: { expenseId: 'e1', description: 'Hotel', amountCents: 5000, deleted: true },
    });

    render(<ActivityFeed groupId="g1" entries={[entry]} />);

    expect(screen.getByText('deleted')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('shows a Delete action for a live settlement entry, and deletes it on click', async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse(200, { success: true }));
    const entry = makeEntry({
      type: 'SETTLEMENT_CREATED',
      metadata: { settlementId: 's1', amountCents: 2500, deleted: false },
    });

    render(<ActivityFeed groupId="g1" entries={[entry]} />);
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/groups/g1/settlements/s1',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(await screen.findByText('deleted')).toBeInTheDocument();
  });
});
