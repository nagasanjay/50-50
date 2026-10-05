import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { GroupsModule } from '../groups/groups.module';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';

@Module({
  imports: [ActivityModule, GroupsModule],
  controllers: [ImportController],
  providers: [ImportService],
})
export class ImportModule {}
