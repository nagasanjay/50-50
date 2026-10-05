import { Injectable } from '@nestjs/common';
import { ActivityType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface WriteActivityLogParams {
  groupId: string;
  actorId: string;
  type: ActivityType;
  metadata: Prisma.InputJsonValue;
}

const EXPENSE_LOG_TYPES: ActivityType[] = ['EXPENSE_CREATED', 'EXPENSE_UPDATED'];

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async writeLog(tx: Prisma.TransactionClient, params: WriteActivityLogParams) {
    return tx.activityLog.create({ data: params });
  }

  async listForGroup(groupId: string, take = 50) {
    const logs = await this.prisma.activityLog.findMany({
      where: { groupId },
      orderBy: { createdAt: 'desc' },
      take,
      include: { actor: { select: { id: true, name: true } } },
    });

    const expenseIds = uniqueStringIds(logs, EXPENSE_LOG_TYPES, 'expenseId');
    const settlementIds = uniqueStringIds(logs, ['SETTLEMENT_CREATED'], 'settlementId');

    const [expenses, settlements] = await Promise.all([
      expenseIds.length
        ? this.prisma.expense.findMany({ where: { id: { in: expenseIds } }, select: { id: true, deletedAt: true } })
        : [],
      settlementIds.length
        ? this.prisma.settlement.findMany({
            where: { id: { in: settlementIds } },
            select: { id: true, deletedAt: true, note: true },
          })
        : [],
    ]);

    const expenseById = new Map(expenses.map((e) => [e.id, e]));
    const settlementById = new Map(settlements.map((s) => [s.id, s]));

    return logs.map((log) => {
      const meta = log.metadata as Record<string, unknown>;

      if (EXPENSE_LOG_TYPES.includes(log.type) && typeof meta.expenseId === 'string') {
        const expense = expenseById.get(meta.expenseId);
        return { ...log, metadata: { ...meta, deleted: expense ? expense.deletedAt !== null : true } };
      }

      if (log.type === 'SETTLEMENT_CREATED' && typeof meta.settlementId === 'string') {
        const settlement = settlementById.get(meta.settlementId);
        return {
          ...log,
          metadata: {
            ...meta,
            deleted: settlement ? settlement.deletedAt !== null : true,
            note: settlement?.note ?? null,
          },
        };
      }

      return log;
    });
  }
}

function uniqueStringIds(
  logs: { type: ActivityType; metadata: Prisma.JsonValue }[],
  types: ActivityType[],
  field: string,
): string[] {
  const ids = new Set<string>();
  for (const log of logs) {
    if (!types.includes(log.type)) continue;
    const value = (log.metadata as Record<string, unknown> | null)?.[field];
    if (typeof value === 'string') ids.add(value);
  }
  return Array.from(ids);
}
