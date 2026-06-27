import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { AdminApiKeyGuard } from '../common/admin-api-key.guard';
import { UpdateBroadcastSettingsDto } from '../common/dto';
import { BroadcastService } from './broadcast.service';

@Controller('api/broadcast')
@UseGuards(AdminApiKeyGuard)
export class BroadcastController {
  constructor(private readonly broadcastService: BroadcastService) {}

  @Get('status')
  status() {
    return this.broadcastService.getStatus();
  }

  @Put('settings')
  updateSettings(@Body() dto: UpdateBroadcastSettingsDto) {
    return this.broadcastService.updateSettings(dto);
  }

  @Post('start')
  start() {
    return this.broadcastService.start();
  }

  @Post('pause')
  pause() {
    return this.broadcastService.pause();
  }

  @Post('resume')
  resume() {
    return this.broadcastService.resume();
  }

  @Post('cancel')
  cancel() {
    return this.broadcastService.cancel();
  }
}
