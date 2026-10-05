import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { GroupMemberGuard } from '../groups/group-member.guard';
import { ImportService } from './import.service';
import { PreviewImportDto } from './dto/preview-import.dto';
import { CommitImportDto } from './dto/commit-import.dto';

@UseGuards(GroupMemberGuard)
@Controller('groups/:groupId/import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('preview')
  preview(@Body() dto: PreviewImportDto) {
    return this.importService.preview(dto.csv);
  }

  @Post('commit')
  commit(
    @Param('groupId') groupId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CommitImportDto,
  ) {
    return this.importService.commit(groupId, user.id, dto.csv, dto.memberMap);
  }
}
