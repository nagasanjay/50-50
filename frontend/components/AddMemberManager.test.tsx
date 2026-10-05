import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddMemberManager } from './AddMemberManager';
import type { GroupMember } from '@/lib/types';

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'status',
    json: async () => body,
  } as Response;
}

function makeMember(overrides: Partial<GroupMember> = {}): GroupMember {
  return {
    id: 'm1',
    groupId: 'g1',
    userId: 'u1',
    role: 'MEMBER',
    user: { id: 'u1', name: 'Friend', email: 'friend@example.com', pending: true },
    ...overrides,
  };
}

describe('AddMemberManager', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('adds a person and lists them as not yet registered', async () => {
    const user = userEvent.setup();
    const newMember = makeMember();
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse(201, newMember));

    render(<AddMemberManager groupId="g1" initialMembers={[]} />);

    await user.type(screen.getByLabelText('Name'), 'Friend');
    await user.type(screen.getByLabelText('Email'), 'friend@example.com');
    await user.click(screen.getByRole('button', { name: /add person/i }));

    expect(await screen.findByText('Friend (friend@example.com)')).toBeInTheDocument();
  });

  it('shows an error message when adding a person fails', async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse(409, { message: 'This person is already a member of the group' }),
    );

    render(<AddMemberManager groupId="g1" initialMembers={[]} />);
    await user.type(screen.getByLabelText('Name'), 'Friend');
    await user.type(screen.getByLabelText('Email'), 'friend@example.com');
    await user.click(screen.getByRole('button', { name: /add person/i }));

    expect(
      await screen.findByText('This person is already a member of the group'),
    ).toBeInTheDocument();
  });

  it('removes a pending member from the list', async () => {
    const user = userEvent.setup();
    const existing = makeMember();
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse(200, { success: true }));

    render(<AddMemberManager groupId="g1" initialMembers={[existing]} />);
    expect(screen.getByText('Friend (friend@example.com)')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /remove/i }));

    expect(screen.queryByText('Friend (friend@example.com)')).not.toBeInTheDocument();
  });

  it('shows an error and keeps the member listed when removal is rejected', async () => {
    const user = userEvent.setup();
    const existing = makeMember();
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse(409, { message: 'Cannot remove a member who is already part of an expense' }),
    );

    render(<AddMemberManager groupId="g1" initialMembers={[existing]} />);
    await user.click(screen.getByRole('button', { name: /remove/i }));

    expect(
      await screen.findByText('Cannot remove a member who is already part of an expense'),
    ).toBeInTheDocument();
    expect(screen.getByText('Friend (friend@example.com)')).toBeInTheDocument();
  });

  it('does not list already-registered members as removable', () => {
    const registered = makeMember({
      id: 'm2',
      userId: 'u2',
      user: { id: 'u2', name: 'Registered', email: 'reg@example.com', pending: false },
    });

    render(<AddMemberManager groupId="g1" initialMembers={[registered]} />);

    expect(screen.queryByText('Not yet registered')).not.toBeInTheDocument();
    expect(screen.queryByText('Registered (reg@example.com)')).not.toBeInTheDocument();
  });
});
