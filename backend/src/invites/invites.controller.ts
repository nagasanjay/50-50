import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { GroupMemberGuard } from '../groups/group-member.guard';
import { InvitesService } from './invites.service';
import { CreateInviteDto } from './dto/create-invite.dto';

@UseGuards(GroupMemberGuard)
@Controller('groups/:groupId/invites')
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Post()
  create(@Param('groupId') groupId: string, @Body() dto: CreateInviteDto) {
    return this.invitesService.create(groupId, dto.email, dto.name);
  }

  @Get()
  findAll(@Param('groupId') groupId: string) {
    return this.invitesService.listForGroup(groupId);
  }

  @Delete(':inviteId')
  remove(@Param('groupId') groupId: string, @Param('inviteId') inviteId: string) {
    return this.invitesService.remove(groupId, inviteId);
  }
}
