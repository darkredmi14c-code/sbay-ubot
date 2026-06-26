import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('keywords')
export class Keyword {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  word!: string;

  @Column({ default: true })
  active!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}
