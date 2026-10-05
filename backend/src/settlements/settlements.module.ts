import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { GroupsModule } from '../groups/groups.module';
import { SettlementsController } from './settlements.controller';
import { SettlementsService } from './settlements.service';

@Module({
  imports: [ActivityModule, GroupsModule],
  controllers: [SettlementsController],
  providers: [SettlementsService],
  exports: [SettlementsService],
})
export class SettlementsModule {}
