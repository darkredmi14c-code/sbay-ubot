import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { join } from 'path';
import { AppSetting } from '../entities/app-setting.entity';
import { Keyword } from '../entities/keyword.entity';
import { MonitoredGroup } from '../entities/monitored-group.entity';
import { User } from '../entities/user.entity';

const entities = [Keyword, MonitoredGroup, User, AppSetting];

export function buildTypeOrmConfig(
  config: ConfigService,
): TypeOrmModuleOptions {
  const databaseUrl = config.get<string>('DATABASE_URL');

  if (databaseUrl) {
    const isSupabase = databaseUrl.includes('supabase');
    return {
      type: 'postgres',
      url: databaseUrl,
      entities,
      synchronize: true,
      ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
      extra: {
        max: 10,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 10_000,
      },
    };
  }

  return {
    type: 'better-sqlite3',
    database:
      config.get<string>('DATABASE_PATH') ??
      join(process.cwd(), 'data', 'soatbay.db'),
    entities,
    synchronize: true,
  };
}
