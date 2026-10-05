import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GroupMemberGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const groupId: string | undefined = request.params?.groupId;
    const userId: string | undefined = request.user?.id;

    if (!groupId || !userId) {
      throw new ForbiddenException('Not a member of this group');
    }

    const membership = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });

    if (!membership) {
      throw new ForbiddenException('Not a member of this group');
    }

    request.groupMembership = membership;
    return true;
  }
}
