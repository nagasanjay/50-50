import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { parseSplitwiseCsv, reconstructTransactions } from './csv-import.util';

export interface ImportWarningSummary {
  date: string;
  description: string;
  reason: string;
}

export interface PreviewImportResult {
  memberNames: string[];
  expenseCount: number;
  settlementCount: number;
  warnings: ImportWarningSummary[];
}

export interface CommitImportResult {
  importedExpenses: number;
  importedSettlements: number;
  warnings: ImportWarningSummary[];
}

@Injectable()
export class ImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  preview(csv: string): PreviewImportResult {
    const parsed = parseSplitwiseCsv(csv);
    const { expenses, settlements, warnings } = reconstructTransactions(parsed);

    return {
      memberNames: parsed.memberNames,
      expenseCount: expenses.length,
      settlementCount: settlements.length,
      warnings: warnings.map(toWarningSummary),
    };
  }

  async commit(
    groupId: string,
    actorId: string,
    csv: string,
    memberMap: Record<string, string>,
  ): Promise<CommitImportResult> {
    const parsed = parseSplitwiseCsv(csv);
    const { expenses, settlements, warnings } = reconstructTransactions(parsed);

    const unmapped = parsed.memberNames.filter((name) => !memberMap[name]);
    if (unmapped.length > 0) {
      throw new BadRequestException(`No user mapping provided for: ${unmapped.join(', ')}`);
    }

    const mappedUserIds = Object.values(memberMap);
    const memberships = await this.prisma.groupMember.findMany({
      where: { groupId, userId: { in: mappedUserIds } },
    });
    const validUserIds = new Set(memberships.map((m) => m.userId));
    const invalidMappings = mappedUserIds.filter((id) => !validUserIds.has(id));
    if (invalidMappings.length > 0) {
      throw new BadRequestException('Every mapped user must already be a member of this group');
    }

    await this.prisma.$transaction(
      async (tx) => {
        for (const expense of expenses) {
          const created = await tx.expense.create({
            data: {
              groupId,
              description: expense.description,
              category: expense.category || null,
              amountCents: expense.amountCents,
              splitType: 'EXACT',
              paidById: memberMap[expense.paidByMemberName],
              createdById: actorId,
              incurredAt: parseImportDate(expense.date),
              participants: {
                create: expense.participants.map((p) => ({
                  userId: memberMap[p.memberName],
                  shareCents: p.shareCents,
                })),
              },
            },
          });
          await this.activity.writeLog(tx, {
            groupId,
            actorId,
            type: 'EXPENSE_CREATED',
            metadata: { expenseId: created.id, description: created.description, amountCents: created.amountCents },
          });
        }

        for (const settlement of settlements) {
          const created = await tx.settlement.create({
            data: {
              groupId,
              fromUserId: memberMap[settlement.fromMemberName],
              toUserId: memberMap[settlement.toMemberName],
              amountCents: settlement.amountCents,
              note: settlement.description,
              createdAt: parseImportDate(settlement.date),
            },
          });
          await this.activity.writeLog(tx, {
            groupId,
            actorId,
            type: 'SETTLEMENT_CREATED',
            metadata: {
              settlementId: created.id,
              fromUserId: created.fromUserId,
              toUserId: created.toUserId,
              amountCents: created.amountCents,
            },
          });
        }
      },
      { timeout: 60000 },
    );

    return {
      importedExpenses: expenses.length,
      importedSettlements: settlements.length,
      warnings: warnings.map(toWarningSummary),
    };
  }
}

function parseImportDate(date: string): Date {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function toWarningSummary(warning: { row: { date: string; description: string }; reason: string }): ImportWarningSummary {
  return { date: warning.row.date, description: warning.row.description, reason: warning.reason };
}
