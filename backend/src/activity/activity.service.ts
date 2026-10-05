import { Injectable } from '@nestjs/common';
import { ActivityType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface WriteActivityLogParams {
  groupId: string;
  actorId: string;
  type: ActivityType;
  metadata: Prisma.InputJsonValue;
}

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async writeLog(tx: Prisma.TransactionClient, params: WriteActivityLogParams) {
    return tx.activityLog.create({ data: params });
  }

  async listForGroup(groupId: string, take = 50) {
    return this.prisma.activityLog.findMany({
      where: { groupId },
      orderBy: { createdAt: 'desc' },
      take,
      include: { actor: { select: { id: true, name: true } } },
    });
  }
}
