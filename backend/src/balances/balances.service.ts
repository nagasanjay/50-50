import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { computeNetBalances, simplifyDebts } from './balances.util';

type GroupBySumResult = Record<string, unknown>[];

@Injectable()
export class BalancesService {
  constructor(private readonly prisma: PrismaService) {}

  async getBalances(groupId: string) {
    const members = await this.prisma.groupMember.findMany({
      where: { groupId },
      include: { user: { select: { id: true, name: true } } },
    });
    const userIds = members.map((m) => m.userId);

    const [paidGroups, owedGroups, settledOutGroups, settledInGroups] = await Promise.all([
      this.prisma.expense.groupBy({
        by: ['paidById'],
        where: { groupId, deletedAt: null },
        _sum: { amountCents: true },
      }),
      this.prisma.expenseParticipant.groupBy({
        by: ['userId'],
        where: { expense: { groupId, deletedAt: null } },
        _sum: { shareCents: true },
      }),
      this.prisma.settlement.groupBy({
        by: ['fromUserId'],
        where: { groupId, deletedAt: null },
        _sum: { amountCents: true },
      }),
      this.prisma.settlement.groupBy({
        by: ['toUserId'],
        where: { groupId, deletedAt: null },
        _sum: { amountCents: true },
      }),
    ]);

    const paid = toRecord(paidGroups, 'paidById', 'amountCents');
    const owed = toRecord(owedGroups, 'userId', 'shareCents');
    const settledOut = toRecord(settledOutGroups, 'fromUserId', 'amountCents');
    const settledIn = toRecord(settledInGroups, 'toUserId', 'amountCents');

    const net = computeNetBalances({ userIds, paid, owed, settledOut, settledIn });
    const simplifiedTransfers = simplifyDebts(net);

    const nameById = new Map(members.map((m) => [m.userId, m.user.name]));

    return {
      balances: net.map((b) => ({ ...b, name: nameById.get(b.userId) ?? null })),
      simplifiedTransfers,
    };
  }
}

function toRecord(
  groups: GroupBySumResult,
  keyField: string,
  sumField: string,
): Record<string, number> {
  const record: Record<string, number> = {};
  for (const g of groups) {
    const key = g[keyField] as string;
    const sum = (g._sum as Record<string, number | null>)[sumField] ?? 0;
    record[key] = sum;
  }
  return record;
}
