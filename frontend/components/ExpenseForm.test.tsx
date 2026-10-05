import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExpenseForm } from './ExpenseForm';

const members = [
  { userId: 'u1', name: 'Alice' },
  { userId: 'u2', name: 'Bob' },
];

describe('ExpenseForm', () => {
  it('submits an EQUAL split with the amount converted to cents', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();

    render(<ExpenseForm members={members} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Description'), 'Hotel');
    await user.type(screen.getByLabelText('Amount (₹)'), '45.50');
    await user.click(screen.getByLabelText('Alice'));
    await user.click(screen.getByLabelText('Bob'));
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      description: 'Hotel',
      amountCents: 4550,
      splitType: 'EQUAL',
      paidById: 'u1',
      participants: { userIds: ['u1', 'u2'] },
    });
  });

  it('resets participants when switching split type', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();

    render(<ExpenseForm members={members} onSubmit={onSubmit} />);

    await user.click(screen.getByLabelText('Alice'));
    await user.selectOptions(screen.getByLabelText('Split type'), 'EXACT');

    await user.type(screen.getByLabelText('Description'), 'Snacks');
    await user.type(screen.getByLabelText('Amount (₹)'), '10');
    await user.click(screen.getByRole('button', { name: /save/i }));

    const call = onSubmit.mock.calls[0][0];
    expect(call.splitType).toBe('EXACT');
    expect(call.participants).toEqual({ shares: [] });
  });

  it('allows changing who paid', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();

    render(<ExpenseForm members={members} onSubmit={onSubmit} />);

    await user.selectOptions(screen.getByLabelText('Paid by'), 'u2');
    await user.type(screen.getByLabelText('Description'), 'Snacks');
    await user.type(screen.getByLabelText('Amount (₹)'), '5');
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(onSubmit.mock.calls[0][0].paidById).toBe('u2');
  });

  it('uses the configured submit label', () => {
    render(<ExpenseForm members={members} submitLabel="Update expense" onSubmit={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Update expense' })).toBeInTheDocument();
  });
});
