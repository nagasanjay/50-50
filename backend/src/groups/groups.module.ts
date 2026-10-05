import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';
import { GroupMemberGuard } from './group-member.guard';

@Module({
  imports: [ActivityModule],
  controllers: [GroupsController],
  providers: [GroupsService, GroupMemberGuard],
  exports: [GroupsService, GroupMemberGuard],
})
export class GroupsModule {}
