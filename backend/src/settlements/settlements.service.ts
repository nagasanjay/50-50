import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { CreateSettlementDto } from './dto/create-settlement.dto';

@Injectable()
export class SettlementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  async create(groupId: string, actorId: string, dto: CreateSettlementDto) {
    if (dto.fromUserId === dto.toUserId) {
      throw new BadRequestException('fromUserId and toUserId must differ');
    }

    const [fromMember, toMember] = await Promise.all([
      this.prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId: dto.fromUserId } },
      }),
      this.prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId: dto.toUserId } },
      }),
    ]);

    if (!fromMember || !toMember) {
      throw new NotFoundException('Both users must be members of this group');
    }

    return this.prisma.$transaction(async (tx) => {
      const settlement = await tx.settlement.create({
        data: {
          groupId,
          fromUserId: dto.fromUserId,
          toUserId: dto.toUserId,
          amountCents: dto.amountCents,
          note: dto.note,
        },
      });

      await this.activity.writeLog(tx, {
        groupId,
        actorId,
        type: 'SETTLEMENT_CREATED',
        metadata: {
          settlementId: settlement.id,
          fromUserId: settlement.fromUserId,
          toUserId: settlement.toUserId,
          amountCents: settlement.amountCents,
        },
      });

      return settlement;
    });
  }

  async findAllForGroup(groupId: string) {
    return this.prisma.settlement.findMany({
      where: { groupId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(groupId: string, settlementId: string) {
    const settlement = await this.prisma.settlement.findFirst({
      where: { id: settlementId, groupId },
    });
    if (!settlement) {
      throw new NotFoundException('Settlement not found');
    }
    if (settlement.deletedAt) {
      return { success: true };
    }

    await this.prisma.settlement.update({
      where: { id: settlementId },
      data: { deletedAt: new Date() },
    });
    return { success: true };
  }
}
