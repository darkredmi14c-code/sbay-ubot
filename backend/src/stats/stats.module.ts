import { Module } from '@nestjs/common';
import { KeywordsModule } from '../keywords/keywords.module';
import { GroupsModule } from '../groups/groups.module';
import { UsersModule } from '../users/users.module';
import { TelegramModule } from '../telegram/telegram.module';
import { StatsController } from './stats.controller';

@Module({
  imports: [KeywordsModule, GroupsModule, UsersModule, TelegramModule],
  controllers: [StatsController],
})
export class StatsModule {}
