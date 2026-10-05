import { computeNetBalances, simplifyDebts } from './balances.util';

describe('computeNetBalances', () => {
  it('nets a two-person expense to zero after settling up', () => {
    // A pays 100 for a 50/50 expense with B
    const beforeSettlement = computeNetBalances({
      userIds: ['a', 'b'],
      paid: { a: 100 },
      owed: { a: 50, b: 50 },
      settledOut: {},
      settledIn: {},
    });
    expect(beforeSettlement).toEqual(
      expect.arrayContaining([
        { userId: 'a', netCents: 50 },
        { userId: 'b', netCents: -50 },
      ]),
    );

    // B settles up: Settlement{from: B, to: A, amount: 50}
    const afterSettlement = computeNetBalances({
      userIds: ['a', 'b'],
      paid: { a: 100 },
      owed: { a: 50, b: 50 },
      settledOut: { b: 50 },
      settledIn: { a: 50 },
    });
    expect(afterSettlement).toEqual(
      expect.arrayContaining([
        { userId: 'a', netCents: 0 },
        { userId: 'b', netCents: 0 },
      ]),
    );
  });

  it('defaults missing values to zero for members with no activity', () => {
    const result = computeNetBalances({
      userIds: ['a', 'b', 'c'],
      paid: { a: 90 },
      owed: { a: 30, b: 30, c: 30 },
      settledOut: {},
      settledIn: {},
    });
    expect(result).toEqual(
      expect.arrayContaining([
        { userId: 'a', netCents: 60 },
        { userId: 'b', netCents: -30 },
        { userId: 'c', netCents: -30 },
      ]),
    );
  });
});

describe('simplifyDebts', () => {
  it('produces no transfers when all balances are zero', () => {
    const result = simplifyDebts([
      { userId: 'a', netCents: 0 },
      { userId: 'b', netCents: 0 },
    ]);
    expect(result).toEqual([]);
  });

  it('matches a single debtor with a single creditor', () => {
    const result = simplifyDebts([
      { userId: 'a', netCents: 50 },
      { userId: 'b', netCents: -50 },
    ]);
    expect(result).toEqual([{ fromUserId: 'b', toUserId: 'a', amountCents: 50 }]);
  });

  it('simplifies a 3-person group to the minimum number of transfers', () => {
    // a is owed 60, b is owed 10, c owes 70
    const result = simplifyDebts([
      { userId: 'a', netCents: 60 },
      { userId: 'b', netCents: 10 },
      { userId: 'c', netCents: -70 },
    ]);
    const totalTransferred = result.reduce((sum, t) => sum + t.amountCents, 0);
    expect(totalTransferred).toBe(70);
    expect(result.every((t) => t.fromUserId === 'c')).toBe(true);
    expect(result).toHaveLength(2);
  });

  it('matches multiple debtors against multiple creditors', () => {
    // a is owed 80, b is owed 20; c owes 60, d owes 40
    const result = simplifyDebts([
      { userId: 'a', netCents: 80 },
      { userId: 'b', netCents: 20 },
      { userId: 'c', netCents: -60 },
      { userId: 'd', netCents: -40 },
    ]);
    const totalTransferred = result.reduce((sum, t) => sum + t.amountCents, 0);
    expect(totalTransferred).toBe(100);
    const owedToA = result.filter((t) => t.toUserId === 'a').reduce((s, t) => s + t.amountCents, 0);
    const owedToB = result.filter((t) => t.toUserId === 'b').reduce((s, t) => s + t.amountCents, 0);
    expect(owedToA).toBe(80);
    expect(owedToB).toBe(20);
  });
});
