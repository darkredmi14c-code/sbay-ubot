import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PQueue from 'p-queue';

type TaskFn = () => Promise<void>;

@Injectable()
export class MessageQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(MessageQueueService.name);
  private readonly filterQueue: PQueue;
  private readonly aiQueue: PQueue;

  private processedTotal = 0;
  private skippedTotal = 0;
  private publishedTotal = 0;

  constructor(private readonly config: ConfigService) {
    const queueConcurrency = Number(this.config.get('QUEUE_CONCURRENCY', 8));
    const aiConcurrency = Number(this.config.get('AI_QUEUE_CONCURRENCY', 3));

    this.filterQueue = new PQueue({
      concurrency: queueConcurrency,
      autoStart: true,
    });

    this.aiQueue = new PQueue({
      concurrency: aiConcurrency,
      autoStart: true,
      interval: 1000,
      intervalCap: aiConcurrency,
    });

    this.logger.log(
      `Navbatlar: filter=${queueConcurrency}, AI=${aiConcurrency}`,
    );
  }

  /** Tez filtrlash (kalit so'z, bot, bazada bor-yo'qligi) */
  enqueueFilter(task: TaskFn): void {
    void this.filterQueue.add(async () => {
      try {
        await task();
      } catch (error) {
        this.logger.error(`Filter navbat xatosi: ${(error as Error).message}`);
      }
    });
  }

  /** AI tahlil — cheklangan tezlikda */
  enqueueAi(task: TaskFn): void {
    void this.aiQueue.add(async () => {
      try {
        await task();
        this.processedTotal++;
      } catch (error) {
        this.logger.error(`AI navbat xatosi: ${(error as Error).message}`);
      }
    });
  }

  incrementSkipped(): void {
    this.skippedTotal++;
  }

  incrementPublished(): void {
    this.publishedTotal++;
  }

  getStats() {
    return {
      filterPending: this.filterQueue.pending,
      filterSize: this.filterQueue.size,
      aiPending: this.aiQueue.pending,
      aiSize: this.aiQueue.size,
      processedTotal: this.processedTotal,
      skippedTotal: this.skippedTotal,
      publishedTotal: this.publishedTotal,
    };
  }

  async onModuleDestroy(): Promise<void> {
    this.filterQueue.pause();
    this.aiQueue.pause();
    await Promise.all([this.filterQueue.onIdle(), this.aiQueue.onIdle()]);
  }
}
