import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportWizard } from './ImportWizard';
import { clearAccessToken } from '@/lib/auth';

const members = [
  { userId: 'u1', name: 'Alice' },
  { userId: 'u2', name: 'Bob' },
];

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'status',
    json: async () => body,
  } as Response;
}

describe('ImportWizard', () => {
  beforeEach(() => {
    clearAccessToken();
    global.fetch = jest.fn();
  });

  it('walks through preview -> map -> commit and shows the result summary', async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(
        jsonResponse(200, {
          memberNames: ['Alice', 'Bob'],
          expenseCount: 2,
          settlementCount: 1,
          warnings: [],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { importedExpenses: 2, importedSettlements: 1, warnings: [] }),
      );

    render(<ImportWizard groupId="g1" members={members} />);

    await user.type(screen.getByLabelText(/paste the csv/i), 'Date,Description,...');
    await user.click(screen.getByRole('button', { name: /preview/i }));

    expect(await screen.findByText(/2 expense\(s\) and 1 settlement\(s\) found/)).toBeInTheDocument();
    // Members with matching names are auto-mapped, so Import should be immediately enabled
    const importButton = screen.getByRole('button', { name: /^import$/i });
    expect(importButton).toBeEnabled();

    await user.click(importButton);

    expect(await screen.findByText('Import complete')).toBeInTheDocument();
    expect(screen.getByText('Imported 2 expense(s) and 1 settlement(s).')).toBeInTheDocument();

    const commitCallBody = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body);
    expect(commitCallBody.memberMap).toEqual({ Alice: 'u1', Bob: 'u2' });
  });

  it('disables Import until every CSV member is mapped', async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse(200, {
        memberNames: ['Charlie'], // no matching group member by name
        expenseCount: 1,
        settlementCount: 0,
        warnings: [],
      }),
    );

    render(<ImportWizard groupId="g1" members={members} />);

    await user.type(screen.getByLabelText(/paste the csv/i), 'Date,Description,...');
    await user.click(screen.getByRole('button', { name: /preview/i }));

    await screen.findByText('Charlie');
    expect(screen.getByRole('button', { name: /^import$/i })).toBeDisabled();

    await user.selectOptions(screen.getByRole('combobox'), 'u1');
    expect(screen.getByRole('button', { name: /^import$/i })).toBeEnabled();
  });

  it('shows skipped-row warnings in the result summary', async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(
        jsonResponse(200, { memberNames: ['Alice'], expenseCount: 1, settlementCount: 0, warnings: [] }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          importedExpenses: 1,
          importedSettlements: 0,
          warnings: [{ date: '2025-01-01', description: 'Weird row', reason: 'No payer could be identified' }],
        }),
      );

    render(<ImportWizard groupId="g1" members={members} />);
    await user.type(screen.getByLabelText(/paste the csv/i), 'Date,Description,...');
    await user.click(screen.getByRole('button', { name: /preview/i }));
    await user.click(await screen.findByRole('button', { name: /^import$/i }));

    expect(await screen.findByText(/Skipped rows \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/Weird row: No payer could be identified/)).toBeInTheDocument();
  });

  it('shows an error message when the commit request fails', async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(
        jsonResponse(200, { memberNames: ['Alice'], expenseCount: 1, settlementCount: 0, warnings: [] }),
      )
      .mockResolvedValueOnce(jsonResponse(400, { message: 'Every mapped user must already be a member' }));

    render(<ImportWizard groupId="g1" members={members} />);
    await user.type(screen.getByLabelText(/paste the csv/i), 'Date,Description,...');
    await user.click(screen.getByRole('button', { name: /preview/i }));
    await user.click(await screen.findByRole('button', { name: /^import$/i }));

    expect(await screen.findByText('Every mapped user must already be a member')).toBeInTheDocument();
  });

  it('shows an error message when the preview request fails', async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse(400, { message: 'Invalid CSV format' }),
    );

    render(<ImportWizard groupId="g1" members={members} />);
    await user.type(screen.getByLabelText(/paste the csv/i), 'garbage');
    await user.click(screen.getByRole('button', { name: /preview/i }));

    expect(await screen.findByText('Invalid CSV format')).toBeInTheDocument();
  });
});
