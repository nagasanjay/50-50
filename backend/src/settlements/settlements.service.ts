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
      where: { groupId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
