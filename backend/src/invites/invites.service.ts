import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';

@Injectable()
export class InvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  async create(groupId: string, email: string, name: string) {
    const normalizedEmail = normalize(email);

    const existingMember = await this.prisma.groupMember.findFirst({
      where: { groupId, user: { email: { equals: normalizedEmail, mode: 'insensitive' } } },
    });
    if (existingMember) {
      throw new ConflictException('This person is already a member of the group');
    }

    const existingInvite = await this.prisma.groupInvite.findUnique({
      where: { groupId_email: { groupId, email: normalizedEmail } },
    });
    if (existingInvite) {
      throw new ConflictException('An invite for this email already exists');
    }

    return this.prisma.groupInvite.create({
      data: { groupId, email: normalizedEmail, name },
    });
  }

  async listForGroup(groupId: string) {
    return this.prisma.groupInvite.findMany({
      where: { groupId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(groupId: string, inviteId: string) {
    const invite = await this.prisma.groupInvite.findFirst({ where: { id: inviteId, groupId } });
    if (!invite) {
      throw new NotFoundException('Invite not found');
    }
    await this.prisma.groupInvite.delete({ where: { id: invite.id } });
    return { success: true };
  }

  /** Called from AuthService.register, inside the same transaction as user creation. */
  async consumeInvitesForNewUser(
    tx: Prisma.TransactionClient,
    userId: string,
    email: string,
  ): Promise<void> {
    const normalizedEmail = normalize(email);
    const invites = await tx.groupInvite.findMany({ where: { email: normalizedEmail } });

    for (const invite of invites) {
      await tx.groupMember.create({ data: { groupId: invite.groupId, userId, role: 'MEMBER' } });
      await this.activity.writeLog(tx, {
        groupId: invite.groupId,
        actorId: userId,
        type: 'MEMBER_JOINED',
        metadata: { viaInvite: true },
      });
      await tx.groupInvite.delete({ where: { id: invite.id } });
    }
  }
}

function normalize(email: string): string {
  return email.trim().toLowerCase();
}
