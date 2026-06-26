import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('monitored_groups')
export class MonitoredGroup {
  @PrimaryGeneratedColumn()
  id!: number;

  /** Telegram chat ID (masalan: -1001234567890) */
  @Column({ type: 'text', unique: true })
  telegramId!: string;

  @Column({ type: 'text', nullable: true })
  title!: string | null;

  @Column({ type: 'text', nullable: true })
  link!: string | null;

  @Column({ default: true })
  active!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}
