import { Module, forwardRef } from '@nestjs/common';
import { GroupsModule } from '../groups/groups.module';
import { KeywordsModule } from '../keywords/keywords.module';
import { MessagesModule } from '../messages/messages.module';
import { QueueModule } from '../queue/queue.module';
import { TelegramBroadcastClientService } from './telegram-broadcast-client.service';
import { TelegramClientService } from './telegram-client.service';
import { TelegramController } from './telegram.controller';
import { TelegramDirectMessageService } from './telegram-direct-message.service';
import { TelegramGroupPollerService } from './telegram-group-poller.service';
import { TelegramPublisherService } from './telegram-publisher.service';

@Module({
  imports: [
    GroupsModule,
    KeywordsModule,
    QueueModule,
    forwardRef(() => MessagesModule),
  ],
  controllers: [TelegramController],
  providers: [
    TelegramClientService,
    TelegramBroadcastClientService,
    TelegramDirectMessageService,
    TelegramGroupPollerService,
    TelegramPublisherService,
  ],
  exports: [
    TelegramClientService,
    TelegramBroadcastClientService,
    TelegramDirectMessageService,
    TelegramPublisherService,
  ],
})
export class TelegramModule {}
