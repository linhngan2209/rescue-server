import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, Index,
} from 'typeorm';

@Entity('position_logs')
@Index(['deviceId', 'timestamp'])
@Index(['timestamp'])
export class PositionLog {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  // Chỉ dùng @Column — không khai báo @ManyToOne để tránh conflict FindOptionsWhere
  @Column({ name: 'device_id', type: 'text' })
  deviceId: string;

  @Column({ type: 'float' })
  lat: number;

  @Column({ type: 'float' })
  lng: number;

  @Column({ type: 'float', nullable: true })
  speed: number;

  @Column({ name: 'in_danger', type: 'boolean', default: false })
  inDanger: boolean;

  @Column({ name: 'dist_to_incident', type: 'float', nullable: true })
  distToIncident: number;

  @CreateDateColumn({ type: 'timestamptz' })
  timestamp: Date;
}