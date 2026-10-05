import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SplitInput, type SplitParticipantsValue } from './SplitInput';

const members = [
  { userId: 'u1', name: 'Alice' },
  { userId: 'u2', name: 'Bob' },
];

/** Mirrors how ExpenseForm actually uses SplitInput: state lives in the parent and
 * re-renders on every change, so controlled inputs accumulate keystrokes correctly. */
function ControlledSplitInput({
  splitType,
  initial,
  onChange,
}: {
  splitType: 'EQUAL' | 'EXACT' | 'PERCENTAGE';
  initial: SplitParticipantsValue;
  onChange: (value: SplitParticipantsValue) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <SplitInput
      members={members}
      splitType={splitType}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

describe('SplitInput', () => {
  it('toggles a member in and out of an EQUAL split', async () => {
    const user = userEvent.setup();
    let value: SplitParticipantsValue = { userIds: ['u1'] };
    const onChange = jest.fn((next: SplitParticipantsValue) => {
      value = next;
    });

    const { rerender } = render(
      <SplitInput members={members} splitType="EQUAL" value={value} onChange={onChange} />,
    );

    await user.click(screen.getByLabelText('Bob'));
    expect(onChange).toHaveBeenCalledWith({ userIds: ['u1', 'u2'] });

    rerender(<SplitInput members={members} splitType="EQUAL" value={value} onChange={onChange} />);
    await user.click(screen.getByLabelText('Alice'));
    expect(onChange).toHaveBeenLastCalledWith({ userIds: ['u2'] });
  });

  it('converts dollar input into cents for an EXACT split', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(<ControlledSplitInput splitType="EXACT" initial={{ shares: [] }} onChange={onChange} />);

    const aliceInput = screen.getAllByRole('spinbutton')[0];
    await user.type(aliceInput, '12.5');

    const lastCall = onChange.mock.calls.at(-1)[0];
    expect(lastCall.shares).toContainEqual({ userId: 'u1', amountCents: 1250 });
  });

  it('keeps percentage values as-is for a PERCENTAGE split', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(
      <ControlledSplitInput splitType="PERCENTAGE" initial={{ shares: [] }} onChange={onChange} />,
    );

    const bobInput = screen.getAllByRole('spinbutton')[1];
    await user.type(bobInput, '35');

    const lastCall = onChange.mock.calls.at(-1)[0];
    expect(lastCall.shares).toContainEqual({ userId: 'u2', percentage: 35 });
  });

  it('treats a non-numeric amount as zero instead of NaN', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(
      <ControlledSplitInput
        splitType="EXACT"
        initial={{ shares: [{ userId: 'u1', amountCents: 500 }] }}
        onChange={onChange}
      />,
    );

    const aliceInput = screen.getAllByRole('spinbutton')[0];
    await user.clear(aliceInput);

    const lastCall = onChange.mock.calls.at(-1)[0];
    expect(lastCall.shares).toContainEqual({ userId: 'u1', amountCents: 0 });
  });

  it('defaults to an empty list when the EQUAL value shape is missing userIds', () => {
    render(
      <SplitInput members={members} splitType="EQUAL" value={{ shares: [] } as never} onChange={jest.fn()} />,
    );
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(checkboxes.every((c) => !c.checked)).toBe(true);
  });

  it('defaults to an empty list when the EXACT/PERCENTAGE value shape is missing shares', () => {
    render(
      <SplitInput members={members} splitType="EXACT" value={{ userIds: [] } as never} onChange={jest.fn()} />,
    );
    const inputs = screen.getAllByRole('spinbutton') as HTMLInputElement[];
    expect(inputs.every((i) => i.value === '')).toBe(true);
  });
});
