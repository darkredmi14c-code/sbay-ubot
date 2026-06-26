import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AdminApiKeyGuard } from '../common/admin-api-key.guard';
import { TelegramClientService } from './telegram-client.service';

@Controller('api/telegram')
@UseGuards(AdminApiKeyGuard)
export class TelegramController {
  constructor(private readonly telegramService: TelegramClientService) {}

  @Get('status')
  getStatus() {
    return this.telegramService.getStatus();
  }

  @Post('resolve-groups')
  resolveGroups() {
    return this.telegramService.resolveAllGroups();
  }
}
