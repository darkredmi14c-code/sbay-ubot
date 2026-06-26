import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { KeywordsService } from '../keywords/keywords.service';
import { GroupsService } from '../groups/groups.service';
import { UsersService } from '../users/users.service';
import { TelegramClientService } from '../telegram/telegram-client.service';
import { StatsResponse } from '../common/types';
import { resolveFrontendPath } from '../config/frontend-path';

@Controller('api')
export class StatsController {
  constructor(
    private readonly keywordsService: KeywordsService,
    private readonly groupsService: GroupsService,
    private readonly usersService: UsersService,
    private readonly telegramService: TelegramClientService,
    private readonly config: ConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  @Get('stats')
  async getStats(): Promise<StatsResponse> {
    const [employers, seekers, scammers, unseen, keywords, groups] =
      await Promise.all([
        this.usersService.countByType('employer'),
        this.usersService.countByType('seeker'),
        this.usersService.countByType('scammer'),
        this.usersService.countUnseen(),
        this.keywordsService.findAll(),
        this.groupsService.findAll(),
      ]);

    return {
      employers,
      seekers,
      scammers,
      unseen,
      keywords: keywords.length,
      groups: groups.length,
      telegram: this.telegramService.getStatus(),
    };
  }

  /** Render health check va UptimeRobot uchun */
  @Get('health')
  async health() {
    let dbOk = false;
    try {
      await this.dataSource.query('SELECT 1');
      dbOk = true;
    } catch {
      dbOk = false;
    }

    const telegram = this.telegramService.getStatus();
    const frontend = resolveFrontendPath();

    return {
      status: dbOk && telegram.connected ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbOk ? 'connected' : 'error',
      telegram: telegram.connected ? 'connected' : 'disconnected',
      frontend: frontend ? 'served' : 'not_built',
      version: process.env.npm_package_version ?? '1.0.0',
    };
  }

  /** UptimeRobot ping uchun eng yengil endpoint */
  @Get('ping')
  ping() {
    return { pong: true, ts: Date.now() };
  }
}
