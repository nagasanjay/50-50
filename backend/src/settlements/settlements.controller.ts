import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { GroupMemberGuard } from '../groups/group-member.guard';
import { SettlementsService } from './settlements.service';
import { CreateSettlementDto } from './dto/create-settlement.dto';

@UseGuards(GroupMemberGuard)
@Controller('groups/:groupId/settlements')
export class SettlementsController {
  constructor(private readonly settlementsService: SettlementsService) {}

  @Post()
  create(
    @Param('groupId') groupId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateSettlementDto,
  ) {
    return this.settlementsService.create(groupId, user.id, dto);
  }

  @Get()
  findAll(@Param('groupId') groupId: string) {
    return this.settlementsService.findAllForGroup(groupId);
  }

  @Delete(':settlementId')
  remove(@Param('groupId') groupId: string, @Param('settlementId') settlementId: string) {
    return this.settlementsService.remove(groupId, settlementId);
  }
}
