import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { JoinGroupDto } from './dto/join-group.dto';
import { GroupMemberGuard } from './group-member.guard';

@Controller()
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post('groups')
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateGroupDto) {
    return this.groupsService.create(user.id, dto.name);
  }

  @Get('groups')
  listMine(@CurrentUser() user: CurrentUserPayload) {
    return this.groupsService.listForUser(user.id);
  }

  @Post('groups/join')
  join(@CurrentUser() user: CurrentUserPayload, @Body() dto: JoinGroupDto) {
    return this.groupsService.join(user.id, dto.inviteCode);
  }

  @UseGuards(GroupMemberGuard)
  @Get('groups/:groupId')
  getOne(@Param('groupId') groupId: string) {
    return this.groupsService.getById(groupId);
  }

  @UseGuards(GroupMemberGuard)
  @Get('groups/:groupId/members')
  listMembers(@Param('groupId') groupId: string) {
    return this.groupsService.listMembers(groupId);
  }
}
