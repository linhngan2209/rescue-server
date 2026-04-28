import {
  Entity, PrimaryColumn, Column,
  CreateDateColumn, OneToMany,
} from 'typeorm';

export enum DeviceType {
  AMBULANCE = 'ambulance',
  UAV       = 'uav',
  RESCUER   = 'rescuer',
}

@Entity('devices')
export class Device {
  @PrimaryColumn({ type: 'text' })
  id: string;

  @Column({ type: 'enum', enum: DeviceType })
  type: DeviceType;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}