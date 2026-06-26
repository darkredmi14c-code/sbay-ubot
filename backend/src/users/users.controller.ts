import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminApiKeyGuard } from '../common/admin-api-key.guard';
import { BlockUserDto, UpdateUserTypeDto } from '../common/dto';
import { UserType } from '../entities/user.entity';
import { UsersService } from './users.service';

@Controller('api/users')
@UseGuards(AdminApiKeyGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(
    @Query('type') type?: UserType,
    @Query('seen', new ParseBoolPipe({ optional: true })) seen?: boolean,
  ) {
    return this.usersService.findAll(type, seen);
  }

  @Get('stats')
  async stats() {
    const [employers, seekers, scammers, unseen] = await Promise.all([
      this.usersService.countByType('employer'),
      this.usersService.countByType('seeker'),
      this.usersService.countByType('scammer'),
      this.usersService.countUnseen(),
    ]);
    return {
      employers,
      seekers,
      scammers,
      unseen,
      total: employers + seekers + scammers,
    };
  }

  @Post('block')
  blockUser(@Body() dto: BlockUserDto) {
    return this.usersService.blockAsScammer(dto.telegramUserId, {
      username: dto.username,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
    });
  }

  @Post('mark-all-seen')
  markAllSeen(@Query('type') type?: UserType) {
    return this.usersService.markAllSeen(type);
  }

  @Post(':id/send-message')
  sendMessage(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.sendMessage(id);
  }

  @Patch(':id/seen')
  markSeen(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.markSeen(id);
  }

  @Patch(':id/type')
  updateType(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserTypeDto,
  ) {
    return this.usersService.updateType(id, dto.type);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }
}
