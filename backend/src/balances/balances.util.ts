export interface NetBalanceInput {
  userIds: string[];
  paid: Record<string, number>;
  owed: Record<string, number>;
  settledOut: Record<string, number>;
  settledIn: Record<string, number>;
}

export interface NetBalance {
  userId: string;
  netCents: number;
}

export interface SimplifiedTransfer {
  fromUserId: string;
  toUserId: string;
  amountCents: number;
}

/**
 * net(u) = paid(u) - owed(u) + settledOut(u) - settledIn(u)
 * Positive => the group owes them. Negative => they owe the group.
 */
export function computeNetBalances({
  userIds,
  paid,
  owed,
  settledOut,
  settledIn,
}: NetBalanceInput): NetBalance[] {
  return userIds.map((userId) => ({
    userId,
    netCents:
      (paid[userId] ?? 0) -
      (owed[userId] ?? 0) +
      (settledOut[userId] ?? 0) -
      (settledIn[userId] ?? 0),
  }));
}

export function simplifyDebts(balances: NetBalance[]): SimplifiedTransfer[] {
  const creditors = balances
    .filter((b) => b.netCents > 0)
    .map((b) => ({ ...b }))
    .sort((a, b) => b.netCents - a.netCents);
  const debtors = balances
    .filter((b) => b.netCents < 0)
    .map((b) => ({ userId: b.userId, netCents: -b.netCents }))
    .sort((a, b) => b.netCents - a.netCents);

  const transfers: SimplifiedTransfer[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = Math.min(debtor.netCents, creditor.netCents);

    if (amount > 0) {
      transfers.push({
        fromUserId: debtor.userId,
        toUserId: creditor.userId,
        amountCents: amount,
      });
    }

    debtor.netCents -= amount;
    creditor.netCents -= amount;

    if (debtor.netCents === 0) i++;
    if (creditor.netCents === 0) j++;
  }

  return transfers;
}
