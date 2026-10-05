import { computeShares } from './split.util';

describe('computeShares', () => {
  describe('EQUAL', () => {
    it('splits evenly when amount divides cleanly', () => {
      const result = computeShares(300, 'EQUAL', { userIds: ['a', 'b', 'c'] });
      expect(result).toEqual([
        { userId: 'a', shareCents: 100 },
        { userId: 'b', shareCents: 100 },
        { userId: 'c', shareCents: 100 },
      ]);
    });

    it('distributes the remainder to the first userIds in sorted order', () => {
      // 100 / 3 = 33.33 -> base 33, remainder 1 cent goes to the first sorted userId
      const result = computeShares(100, 'EQUAL', { userIds: ['c', 'a', 'b'] });
      const total = result.reduce((sum, r) => sum + r.shareCents, 0);
      expect(total).toBe(100);
      // sorted ascending: a, b, c -> a gets the extra cent
      expect(result.find((r) => r.userId === 'a')?.shareCents).toBe(34);
      expect(result.find((r) => r.userId === 'b')?.shareCents).toBe(33);
      expect(result.find((r) => r.userId === 'c')?.shareCents).toBe(33);
    });

    it('throws if userIds is empty', () => {
      expect(() => computeShares(100, 'EQUAL', { userIds: [] })).toThrow();
    });
  });

  describe('EXACT', () => {
    it('passes through exact shares when they sum to the total', () => {
      const result = computeShares(300, 'EXACT', {
        shares: [
          { userId: 'a', amountCents: 200 },
          { userId: 'b', amountCents: 100 },
        ],
      });
      expect(result).toEqual([
        { userId: 'a', shareCents: 200 },
        { userId: 'b', shareCents: 100 },
      ]);
    });

    it('throws when shares do not sum to the total amount', () => {
      expect(() =>
        computeShares(300, 'EXACT', {
          shares: [
            { userId: 'a', amountCents: 200 },
            { userId: 'b', amountCents: 50 },
          ],
        }),
      ).toThrow();
    });

    it('throws if shares is empty', () => {
      expect(() => computeShares(100, 'EXACT', { shares: [] })).toThrow();
    });
  });

  describe('PERCENTAGE', () => {
    it('computes shares proportional to percentage', () => {
      const result = computeShares(300, 'PERCENTAGE', {
        shares: [
          { userId: 'a', percentage: 50 },
          { userId: 'b', percentage: 50 },
        ],
      });
      expect(result).toEqual([
        { userId: 'a', shareCents: 150, percentage: 50 },
        { userId: 'b', shareCents: 150, percentage: 50 },
      ]);
    });

    it('assigns rounding remainder deterministically to the largest percentage', () => {
      // 100 cents split 33.33/33.33/33.34 ~ rounding edge case with 3-way split
      const result = computeShares(100, 'PERCENTAGE', {
        shares: [
          { userId: 'a', percentage: 34 },
          { userId: 'b', percentage: 33 },
          { userId: 'c', percentage: 33 },
        ],
      });
      const total = result.reduce((sum, r) => sum + r.shareCents, 0);
      expect(total).toBe(100);
      expect(result.find((r) => r.userId === 'a')?.shareCents).toBe(34);
    });

    it('removes the rounding overshoot when rounding pushes the total above the amount', () => {
      // 3.5/3.5 both round up to 4/4 = 8, overshooting the 7-cent total by 1
      const result = computeShares(7, 'PERCENTAGE', {
        shares: [
          { userId: 'b', percentage: 50 },
          { userId: 'a', percentage: 50 },
        ],
      });
      const total = result.reduce((sum, r) => sum + r.shareCents, 0);
      expect(total).toBe(7);
      // equal percentages tie-break by userId ascending -> 'a' absorbs the overshoot
      expect(result.find((r) => r.userId === 'a')?.shareCents).toBe(3);
      expect(result.find((r) => r.userId === 'b')?.shareCents).toBe(4);
    });

    it('throws when percentages do not sum to 100', () => {
      expect(() =>
        computeShares(100, 'PERCENTAGE', {
          shares: [
            { userId: 'a', percentage: 60 },
            { userId: 'b', percentage: 30 },
          ],
        }),
      ).toThrow();
    });

    it('throws if shares is empty', () => {
      expect(() => computeShares(100, 'PERCENTAGE', { shares: [] })).toThrow();
    });
  });

  it('throws for an unknown split type', () => {
    expect(() => computeShares(100, 'BOGUS' as any, {} as any)).toThrow();
  });
});
