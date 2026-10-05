import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { computeShares } from './split.util';
import { CreateExpenseDto } from './dto/create-expense.dto';

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  async create(groupId: string, createdById: string, dto: CreateExpenseDto) {
    const shares = computeShares(dto.amountCents, dto.splitType, dto.participants);

    return this.prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          groupId,
          description: dto.description,
          category: dto.category,
          amountCents: dto.amountCents,
          splitType: dto.splitType,
          paidById: dto.paidById,
          createdById,
          incurredAt: dto.incurredAt ? new Date(dto.incurredAt) : undefined,
          participants: {
            create: shares.map((s) => ({
              userId: s.userId,
              shareCents: s.shareCents,
              percentage: s.percentage,
            })),
          },
        },
        include: { participants: true },
      });

      await this.activity.writeLog(tx, {
        groupId,
        actorId: createdById,
        type: 'EXPENSE_CREATED',
        metadata: { expenseId: expense.id, description: expense.description, amountCents: expense.amountCents },
      });

      return expense;
    });
  }

  async findAllForGroup(groupId: string) {
    return this.prisma.expense.findMany({
      where: { groupId },
      orderBy: { incurredAt: 'desc' },
      include: { participants: true },
    });
  }

  async findOne(groupId: string, expenseId: string) {
    const expense = await this.prisma.expense.findFirst({
      where: { id: expenseId, groupId },
      include: { participants: true },
    });
    if (!expense) {
      throw new NotFoundException('Expense not found');
    }
    return expense;
  }

  async update(groupId: string, expenseId: string, actorId: string, dto: CreateExpenseDto) {
    await this.findOne(groupId, expenseId);
    const shares = computeShares(dto.amountCents, dto.splitType, dto.participants);

    return this.prisma.$transaction(async (tx) => {
      await tx.expenseParticipant.deleteMany({ where: { expenseId } });

      const expense = await tx.expense.update({
        where: { id: expenseId },
        data: {
          description: dto.description,
          category: dto.category,
          amountCents: dto.amountCents,
          splitType: dto.splitType,
          paidById: dto.paidById,
          incurredAt: dto.incurredAt ? new Date(dto.incurredAt) : undefined,
          participants: {
            create: shares.map((s) => ({
              userId: s.userId,
              shareCents: s.shareCents,
              percentage: s.percentage,
            })),
          },
        },
        include: { participants: true },
      });

      await this.activity.writeLog(tx, {
        groupId,
        actorId,
        type: 'EXPENSE_UPDATED',
        metadata: { expenseId: expense.id, description: expense.description, amountCents: expense.amountCents },
      });

      return expense;
    });
  }

  async remove(groupId: string, expenseId: string, actorId: string) {
    const expense = await this.findOne(groupId, expenseId);

    await this.prisma.$transaction(async (tx) => {
      await this.activity.writeLog(tx, {
        groupId,
        actorId,
        type: 'EXPENSE_DELETED',
        metadata: { expenseId: expense.id, description: expense.description, amountCents: expense.amountCents },
      });
      await tx.expense.delete({ where: { id: expenseId } });
    });

    return { success: true };
  }
}
