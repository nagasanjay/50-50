import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InviteManager } from './InviteManager';

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'status',
    json: async () => body,
  } as Response;
}

describe('InviteManager', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('sends an invite and adds it to the pending list', async () => {
    const user = userEvent.setup();
    const newInvite = { id: 'i1', groupId: 'g1', name: 'Friend', email: 'friend@example.com', createdAt: '2025-01-01' };
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse(201, newInvite));

    render(<InviteManager groupId="g1" initialInvites={[]} />);

    await user.type(screen.getByLabelText('Name'), 'Friend');
    await user.type(screen.getByLabelText('Email'), 'friend@example.com');
    await user.click(screen.getByRole('button', { name: /send invite/i }));

    expect(await screen.findByText('Friend (friend@example.com)')).toBeInTheDocument();
  });

  it('shows an error message when sending an invite fails', async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse(409, { message: 'An invite for this email already exists' }),
    );

    render(<InviteManager groupId="g1" initialInvites={[]} />);
    await user.type(screen.getByLabelText('Name'), 'Friend');
    await user.type(screen.getByLabelText('Email'), 'friend@example.com');
    await user.click(screen.getByRole('button', { name: /send invite/i }));

    expect(await screen.findByText('An invite for this email already exists')).toBeInTheDocument();
  });

  it('cancels a pending invite and removes it from the list', async () => {
    const user = userEvent.setup();
    const existing = { id: 'i1', groupId: 'g1', name: 'Friend', email: 'friend@example.com', createdAt: '2025-01-01' };
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse(200, { success: true }));

    render(<InviteManager groupId="g1" initialInvites={[existing]} />);
    expect(screen.getByText('Friend (friend@example.com)')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByText('Friend (friend@example.com)')).not.toBeInTheDocument();
  });
});
