import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AiModule } from './ai/ai.module';
import { buildTypeOrmConfig } from './config/database.config';
import { resolveFrontendPath } from './config/frontend-path';
import { GroupsModule } from './groups/groups.module';
import { KeywordsModule } from './keywords/keywords.module';
import { MessagesModule } from './messages/messages.module';
import { QueueModule } from './queue/queue.module';
import { SettingsModule } from './settings/settings.module';
import { StatsModule } from './stats/stats.module';
import { TelegramModule } from './telegram/telegram.module';
import { UsersModule } from './users/users.module';

const frontendPath = resolveFrontendPath();

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ...(frontendPath
      ? [
          ServeStaticModule.forRoot({
            rootPath: frontendPath,
            exclude: ['/api*'],
            serveRoot: '/',
          }),
        ]
      : []),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: buildTypeOrmConfig,
    }),
    KeywordsModule,
    GroupsModule,
    UsersModule,
    SettingsModule,
    AiModule,
    QueueModule,
    MessagesModule,
    TelegramModule,
    StatsModule,
  ],
})
export class AppModule {}
