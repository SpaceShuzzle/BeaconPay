import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type LeadStage = 'NEW' | 'CONTACTED' | 'TOURED' | 'NEGOTIATING' | 'WON' | 'LOST';
export type LeadSource = 'CONTACT_FORM' | 'TOUR' | 'MANUAL';

export interface LeadActivity {
  source?: LeadSource;
  stage?: LeadStage;
  at: string;
  note?: string;
}

@Entity('leads')
export class Lead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  name: string;

  @Column({
    type: 'enum',
    enum: ['CONTACT_FORM', 'TOUR', 'MANUAL'],
    default: 'MANUAL',
  })
  source: LeadSource;

  @Column({
    type: 'enum',
    enum: ['NEW', 'CONTACTED', 'TOURED', 'NEGOTIATING', 'WON', 'LOST'],
    default: 'NEW',
  })
  stage: LeadStage;

  /** Audit trail of stage/source changes, newest last */
  @Column({ type: 'jsonb', default: [] })
  activities: LeadActivity[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
