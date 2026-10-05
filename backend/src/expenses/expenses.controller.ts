import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { GroupMemberGuard } from '../groups/group-member.guard';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';

@UseGuards(GroupMemberGuard)
@Controller('groups/:groupId/expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  create(
    @Param('groupId') groupId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateExpenseDto,
  ) {
    return this.expensesService.create(groupId, user.id, dto);
  }

  @Get()
  findAll(@Param('groupId') groupId: string) {
    return this.expensesService.findAllForGroup(groupId);
  }

  @Get(':expenseId')
  findOne(@Param('groupId') groupId: string, @Param('expenseId') expenseId: string) {
    return this.expensesService.findOne(groupId, expenseId);
  }

  @Patch(':expenseId')
  update(
    @Param('groupId') groupId: string,
    @Param('expenseId') expenseId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateExpenseDto,
  ) {
    return this.expensesService.update(groupId, expenseId, user.id, dto);
  }

  @Delete(':expenseId')
  remove(
    @Param('groupId') groupId: string,
    @Param('expenseId') expenseId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.expensesService.remove(groupId, expenseId, user.id);
  }
}
