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
    const useIpv4 =
      Boolean(process.env.RENDER) ||
      config.get<string>('DATABASE_FORCE_IPV4') === 'true';

    const extra = {
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ...(useIpv4 ? { family: 4 } : {}),
    };

    // Render: db.xxx.supabase.co IPv6 ga resolve bo'ladi — family: 4 yoki pooler URL kerak
    if (useIpv4) {
      const parsed = new URL(databaseUrl);
      return {
        type: 'postgres',
        host: parsed.hostname,
        port: parsed.port ? Number(parsed.port) : 5432,
        username: decodeURIComponent(parsed.username),
        password: decodeURIComponent(parsed.password),
        database: parsed.pathname.replace(/^\//, ''),
        entities,
        synchronize: true,
        ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
        extra,
      };
    }

    return {
      type: 'postgres',
      url: databaseUrl,
      entities,
      synchronize: true,
      ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
      extra,
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
