import { ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { resolveFrontendPath } from './config/frontend-path';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  process.on('unhandledRejection', (reason) => {
    logger.error(`Unhandled rejection: ${reason}`);
  });

  process.on('uncaughtException', (error) => {
    logger.error(`Uncaught exception: ${error.message}`, error.stack);
  });

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
    abortOnError: false,
  });

  const config = app.get(ConfigService);
  const corsOrigin = config.get<string>('CORS_ORIGIN', 'http://localhost:4200');

  app.enableCors({
    origin: corsOrigin.split(',').map((o) => o.trim()),
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  app.enableShutdownHooks();

  const port = config.get<number>('PORT', 3000);
  await app.listen(port, '0.0.0.0');

  const frontend = resolveFrontendPath();
  logger.log(`Server ishga tushdi: port ${port}`);
  logger.log(`Frontend: ${frontend ? 'ulangan' : 'topilmadi (faqat API)'}`);
  logger.log(`Baza: ${config.get('DATABASE_URL') ? 'PostgreSQL' : 'SQLite'}`);
}

bootstrap().catch((err) => {
  logger.error('Ishga tushirish xatosi', err);
  process.exit(1);
});
