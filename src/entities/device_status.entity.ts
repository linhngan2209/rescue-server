import {
  Entity, PrimaryColumn, Column, UpdateDateColumn,
} from 'typeorm';

@Entity('device_status')
export class DeviceStatus {
  @PrimaryColumn({ name: 'device_id', type: 'text' })
  deviceId: string;

  @Column({ name: 'last_lat', type: 'float' })
  lastLat: number;

  @Column({ name: 'last_lng', type: 'float' })
  lastLng: number;

  @Column({ name: 'in_danger', type: 'boolean', default: false })
  inDanger: boolean;

  @UpdateDateColumn({ name: 'last_seen', type: 'timestamptz' })
  lastSeen: Date;
}