import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** employer = e'lon/ish beruvchi, seeker = ishchi, scammer = spamchi (bloklangan) */
export type UserType = 'employer' | 'seeker' | 'scammer';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'text', unique: true })
  telegramUserId!: string;

  @Column({ type: 'text' })
  type!: UserType;

  @Column({ type: 'text', nullable: true })
  username!: string | null;

  @Column({ type: 'text', nullable: true })
  firstName!: string | null;

  @Column({ type: 'text', nullable: true })
  lastName!: string | null;

  @Column({ type: 'text', nullable: true })
  phone!: string | null;

  /** Qaysi guruhdan kelgan */
  @Column({ type: 'text', nullable: true })
  sourceGroupId!: string | null;

  @Column({ type: 'text', nullable: true })
  sourceGroupTitle!: string | null;

  /** Qaysi xabar asosida yozilgan */
  @Column({ type: 'text', nullable: true })
  sourceMessageId!: string | null;

  @Column({ type: 'text', nullable: true })
  messageLink!: string | null;

  @Column({ type: 'text', nullable: true })
  originalText!: string | null;

  /** Admin panelda ko'rilganmi */
  @Column({ default: false })
  seen!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  seenAt!: Date | null;

  /** Shaxsiy xabar yuborilgan vaqt */
  @Column({ type: 'timestamp', nullable: true })
  messageSentAt!: Date | null;

  @CreateDateColumn()
  registeredAt!: Date;
}
