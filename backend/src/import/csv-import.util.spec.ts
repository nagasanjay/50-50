import { parseSplitwiseCsv, reconstructTransactions } from './csv-import.util';

const HEADER = 'Date,Description,Category,Cost,Currency,Alice,Bob,Carol,Dave';

describe('parseSplitwiseCsv', () => {
  it('parses the header into member names and a data row into cents', () => {
    const csv = [
      HEADER,
      '2025-01-02,Booking amount,General,10000.00,INR,-3333.34,0.00,6666.67,-3333.33',
    ].join('\n');

    const result = parseSplitwiseCsv(csv);

    expect(result.memberNames).toEqual(['Alice', 'Bob', 'Carol', 'Dave']);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual({
      date: '2025-01-02',
      description: 'Booking amount',
      category: 'General',
      costCents: 1000000,
      currency: 'INR',
      deltas: { Alice: -333334, Bob: 0, Carol: 666667, Dave: -333333 },
      isPayment: false,
    });
  });

  it('identifies Payment-category rows', () => {
    const csv = [HEADER, '2025-01-02,Alice paid Carol,Payment,8000.01,INR,8000.01,0.00,-8000.01,0.00'].join(
      '\n',
    );
    const result = parseSplitwiseCsv(csv);
    expect(result.rows[0].isPayment).toBe(true);
  });

  it('handles quoted fields containing commas', () => {
    const csv = [
      HEADER,
      '2025-01-11,"Packers and movers Washing machine,Bed,Table and chair",Furniture,6000.00,INR,-2335.00,0.00,-1330.00,3665.00',
    ].join('\n');
    const result = parseSplitwiseCsv(csv);
    expect(result.rows[0].description).toBe('Packers and movers Washing machine,Bed,Table and chair');
  });

  it('extracts the trailing "Total balance" row separately instead of treating it as a transaction', () => {
    const csv = [
      HEADER,
      '2025-01-02,Booking amount,General,10000.00,INR,-3333.34,0.00,6666.67,-3333.33',
      '',
      '2026-10-05,Total balance, , ,INR,-954.66,-21691.04,26706.79,-4061.09',
    ].join('\n');

    const result = parseSplitwiseCsv(csv);

    expect(result.rows).toHaveLength(1);
    expect(result.declaredTotals).toEqual({ Alice: -95466, Bob: -2169104, Carol: 2670679, Dave: -406109 });
  });

  it('unescapes doubled quotes inside a quoted field', () => {
    const csv = [HEADER, '2025-01-02,"He said ""hi""",General,100.00,INR,-50.00,0.00,50.00,0.00'].join('\n');
    const result = parseSplitwiseCsv(csv);
    expect(result.rows[0].description).toBe('He said "hi"');
  });

  it('skips blank lines', () => {
    const csv = [HEADER, '', '  ', '2025-01-02,Booking amount,General,100.00,INR,-50.00,0.00,50.00,0.00'].join(
      '\n',
    );
    const result = parseSplitwiseCsv(csv);
    expect(result.rows).toHaveLength(1);
  });

  it('tolerates a truncated row with fewer columns than the header', () => {
    const csv = [HEADER, '2025-01-02,Short row'].join('\n');
    const result = parseSplitwiseCsv(csv);
    expect(result.rows[0]).toEqual({
      date: '2025-01-02',
      description: 'Short row',
      category: '',
      costCents: NaN,
      currency: '',
      deltas: { Alice: NaN, Bob: NaN, Carol: NaN, Dave: NaN },
      isPayment: false,
    });
  });

  it('returns an empty result for an empty CSV', () => {
    expect(parseSplitwiseCsv('')).toEqual({ memberNames: [], rows: [], declaredTotals: null });
  });
});

describe('reconstructTransactions', () => {
  it('reconstructs a simple expense where one member is uninvolved', () => {
    const parsed = parseSplitwiseCsv(
      [HEADER, '2025-01-02,Booking amount,General,10000.00,INR,-3333.34,0.00,6666.67,-3333.33'].join('\n'),
    );

    const result = reconstructTransactions(parsed);

    expect(result.warnings).toEqual([]);
    expect(result.expenses).toHaveLength(1);
    const expense = result.expenses[0];
    expect(expense.paidByMemberName).toBe('Carol');
    expect(expense.amountCents).toBe(1000000);
    expect(expense.participants).toEqual(
      expect.arrayContaining([
        { memberName: 'Alice', shareCents: 333334 },
        { memberName: 'Carol', shareCents: 333333 },
        { memberName: 'Dave', shareCents: 333333 },
      ]),
    );
    expect(expense.participants).toHaveLength(3); // Bob (delta 0) is excluded
  });

  it('reconstructs an uneven 3-way split with a non-participant', () => {
    const parsed = parseSplitwiseCsv(
      [
        HEADER,
        '2025-01-11,Furniture move,Furniture,6000.00,INR,-2335.00,0.00,-1330.00,3665.00',
      ].join('\n'),
    );

    const [expense] = reconstructTransactions(parsed).expenses;

    expect(expense.paidByMemberName).toBe('Dave');
    expect(expense.participants).toEqual(
      expect.arrayContaining([
        { memberName: 'Alice', shareCents: 233500 },
        { memberName: 'Carol', shareCents: 133000 },
        { memberName: 'Dave', shareCents: 233500 },
      ]),
    );
  });

  it('reconstructs a payment row as a settlement from payer to receiver', () => {
    const parsed = parseSplitwiseCsv(
      [HEADER, '2025-01-02,Alice paid Carol,Payment,8000.01,INR,8000.01,0.00,-8000.01,0.00'].join('\n'),
    );

    const result = reconstructTransactions(parsed);

    expect(result.warnings).toEqual([]);
    expect(result.settlements).toEqual([
      {
        type: 'settlement',
        date: '2025-01-02',
        description: 'Alice paid Carol',
        amountCents: 800001,
        fromMemberName: 'Alice',
        toMemberName: 'Carol',
      },
    ]);
  });

  it('flags a multi-payer expense as a warning instead of guessing', () => {
    const parsed = parseSplitwiseCsv(
      [HEADER, '2025-06-01,Shared cab,Taxi,1000.00,INR,500.00,500.00,-500.00,-500.00'].join('\n'),
    );

    const result = reconstructTransactions(parsed);

    expect(result.expenses).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].reason).toMatch(/multiple payers/i);
  });

  it('flags a payment row whose amounts do not balance', () => {
    const parsed = parseSplitwiseCsv(
      [HEADER, '2025-06-01,Alice paid Carol,Payment,1000.00,INR,900.00,0.00,-900.00,0.00'].join('\n'),
    );

    const result = reconstructTransactions(parsed);

    expect(result.settlements).toEqual([]);
    expect(result.warnings).toHaveLength(1);
  });

  it('flags a payment row with no identifiable payer/receiver pair', () => {
    const parsed = parseSplitwiseCsv(
      [HEADER, '2025-06-01,Odd payment,Payment,1000.00,INR,0.00,0.00,0.00,0.00'].join('\n'),
    );

    const result = reconstructTransactions(parsed);

    expect(result.settlements).toEqual([]);
    expect(result.warnings).toEqual([
      expect.objectContaining({ reason: expect.stringMatching(/exactly one payer/i) }),
    ]);
  });

  it('flags an expense whose reconstructed shares do not sum to the cost', () => {
    // Deltas don't net to zero across the row (corrupted/edited export), so the
    // reconstructed payer share ends up off from the stated cost.
    const parsed = parseSplitwiseCsv(
      [HEADER, '2025-06-01,Corrupted,General,1000.00,INR,-100.00,0.00,99.00,0.00'].join('\n'),
    );

    const result = reconstructTransactions(parsed);

    expect(result.expenses).toEqual([]);
    expect(result.warnings).toEqual([
      expect.objectContaining({ reason: expect.stringMatching(/do not sum to the cost/i) }),
    ]);
  });

  it('flags a row with no identifiable payer', () => {
    const parsed = parseSplitwiseCsv(
      [HEADER, '2025-06-01,Mystery,General,1000.00,INR,0.00,0.00,0.00,0.00'].join('\n'),
    );

    const result = reconstructTransactions(parsed);

    expect(result.expenses).toEqual([]);
    expect(result.warnings).toEqual([
      expect.objectContaining({ reason: expect.stringMatching(/no payer/i) }),
    ]);
  });

  it('flags a row whose cost cannot be parsed', () => {
    const parsed = parseSplitwiseCsv(
      [HEADER, '2025-06-01,Broken,General,not-a-number,INR,0.00,0.00,0.00,0.00'].join('\n'),
    );

    const result = reconstructTransactions(parsed);

    expect(result.warnings).toEqual([
      expect.objectContaining({ reason: expect.stringMatching(/cost/i) }),
    ]);
  });
});
