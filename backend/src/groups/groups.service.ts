import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';

@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  async create(userId: string, name: string) {
    return this.prisma.$transaction(async (tx) => {
      const group = await tx.group.create({
        data: { name, members: { create: { userId, role: 'OWNER' } } },
      });
      await this.activity.writeLog(tx, {
        groupId: group.id,
        actorId: userId,
        type: 'GROUP_CREATED',
        metadata: { name },
      });
      return group;
    });
  }

  async listForUser(userId: string) {
    return this.prisma.group.findMany({
      where: { members: { some: { userId } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(groupId: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } },
    });
    if (!group) {
      throw new NotFoundException('Group not found');
    }
    return group;
  }

  async join(userId: string, inviteCode: string) {
    const group = await this.prisma.group.findUnique({ where: { inviteCode } });
    if (!group) {
      throw new NotFoundException('Invalid invite code');
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.groupMember.findUnique({
        where: { groupId_userId: { groupId: group.id, userId } },
      });
      if (existing) {
        return existing;
      }

      const membership = await tx.groupMember.create({
        data: { groupId: group.id, userId, role: 'MEMBER' },
      });
      await this.activity.writeLog(tx, {
        groupId: group.id,
        actorId: userId,
        type: 'MEMBER_JOINED',
        metadata: {},
      });
      return membership;
    });
  }

  async listMembers(groupId: string) {
    return this.prisma.groupMember.findMany({
      where: { groupId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }
}
