import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { GroupsModule } from '../groups/groups.module';
import { BalancesController } from './balances.controller';
import { BalancesService } from './balances.service';

@Module({
  imports: [ActivityModule, GroupsModule],
  controllers: [BalancesController],
  providers: [BalancesService],
  exports: [BalancesService],
})
export class BalancesModule {}
