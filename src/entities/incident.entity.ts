import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn,
} from 'typeorm';

export enum IncidentType {
  INCIDENT = 'incident', 
  RESCUE   = 'rescue',   
  CENTER   = 'center',   
}

export enum IncidentSource {
  UAV    = 'uav',   
  MANUAL = 'manual',
  ENTITY = 'entity', 
}

export enum IncidentStatus {
  ACTIVE   = 'active',
  RESOLVED = 'resolved',
}

@Entity('incidents')
export class Incident {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'float' })
  lat: number;

  @Column({ type: 'float' })
  lng: number;

  @Column({ type: 'enum', enum: IncidentType })
  type: IncidentType;

  @Column({ type: 'enum', enum: IncidentSource })
  source: IncidentSource;

  @Column({ name: 'reported_by', type: 'text', nullable: true })
  reportedBy: string; 

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: IncidentStatus, default: IncidentStatus.ACTIVE })
  status: IncidentStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date;
}