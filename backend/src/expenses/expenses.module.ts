import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { GroupsModule } from '../groups/groups.module';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';

@Module({
  imports: [ActivityModule, GroupsModule],
  controllers: [ExpensesController],
  providers: [ExpensesService],
  exports: [ExpensesService],
})
export class ExpensesModule {}
