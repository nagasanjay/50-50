import { Body, Controller, Get, Patch } from '@nestjs/common';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async me(@CurrentUser() user: CurrentUserPayload) {
    return this.usersService.findById(user.id);
  }

  @Patch('me')
  async updateMe(@CurrentUser() user: CurrentUserPayload, @Body() dto: UpdateUserDto) {
    return this.usersService.updateName(user.id, dto.name);
  }
}
