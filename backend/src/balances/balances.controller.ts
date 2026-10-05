import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { GroupMemberGuard } from '../groups/group-member.guard';
import { ActivityService } from '../activity/activity.service';
import { BalancesService } from './balances.service';

@UseGuards(GroupMemberGuard)
@Controller('groups/:groupId')
export class BalancesController {
  constructor(
    private readonly balancesService: BalancesService,
    private readonly activityService: ActivityService,
  ) {}

  @Get('balances')
  getBalances(@Param('groupId') groupId: string) {
    return this.balancesService.getBalances(groupId);
  }

  @Get('activity')
  getActivity(@Param('groupId') groupId: string, @Query('take') take?: string) {
    const parsed = take ? parseInt(take, 10) : undefined;
    return this.activityService.listForGroup(groupId, parsed);
  }
}
