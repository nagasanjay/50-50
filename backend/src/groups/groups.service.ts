import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

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
    const members = await this.prisma.groupMember.findMany({
      where: { groupId },
      include: { user: { select: { id: true, name: true, email: true, passwordHash: true } } },
    });
    return members.map((member) => ({
      ...member,
      user: {
        id: member.user.id,
        name: member.user.name,
        email: member.user.email,
        pending: member.user.passwordHash === null,
      },
    }));
  }

  /**
   * Adds someone to the group who may not have an account yet. If no user exists for the
   * email, a pending (password-less) user is created so they can immediately be split into
   * expenses; they can later "claim" that user record by registering with the same email.
   */
  async addMember(groupId: string, actorUserId: string, email: string, name: string) {
    const normalizedEmail = normalizeEmail(email);
    return this.prisma.$transaction(async (tx) => {
      let user = await tx.user.findUnique({ where: { email: normalizedEmail } });
      if (!user) {
        user = await tx.user.create({
          data: { email: normalizedEmail, name, passwordHash: null },
        });
      }

      const existingMembership = await tx.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId: user.id } },
      });
      if (existingMembership) {
        throw new ConflictException('This person is already a member of the group');
      }

      const membership = await tx.groupMember.create({
        data: { groupId, userId: user.id, role: 'MEMBER' },
      });
      await this.activity.writeLog(tx, {
        groupId,
        actorId: actorUserId,
        type: 'MEMBER_JOINED',
        metadata: { addedUserId: user.id },
      });

      return {
        ...membership,
        user: { id: user.id, name: user.name, email: user.email, pending: user.passwordHash === null },
      };
    });
  }

  async removeMember(groupId: string, userId: string) {
    const membership = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      include: { user: { select: { passwordHash: true } } },
    });
    if (!membership) {
      throw new NotFoundException('Membership not found');
    }
    if (membership.user.passwordHash !== null) {
      throw new ConflictException('Cannot remove a member who has already joined');
    }

    const hasExpenseHistory = await this.prisma.expenseParticipant.findFirst({
      where: { userId, expense: { groupId } },
    });
    if (hasExpenseHistory) {
      throw new ConflictException('Cannot remove a member who is already part of an expense');
    }

    await this.prisma.groupMember.delete({ where: { id: membership.id } });
    return { success: true };
  }
}
