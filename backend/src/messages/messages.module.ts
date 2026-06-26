import { Module, forwardRef } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { KeywordsModule } from '../keywords/keywords.module';
import { QueueModule } from '../queue/queue.module';
import { SettingsModule } from '../settings/settings.module';
import { TelegramModule } from '../telegram/telegram.module';
import { UsersModule } from '../users/users.module';
import { MessageProcessorService } from './message-processor.service';

@Module({
  imports: [
    KeywordsModule,
    forwardRef(() => UsersModule),
    AiModule,
    QueueModule,
    SettingsModule,
    forwardRef(() => TelegramModule),
  ],
  providers: [MessageProcessorService],
  exports: [MessageProcessorService],
})
export class MessagesModule {}
