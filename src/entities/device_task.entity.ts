
import {
    Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
} from 'typeorm';

export enum TaskStatus {
    ACTIVE = 'active',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled',
}

@Entity('device_tasks')
export class DeviceTask {
    @PrimaryGeneratedColumn('increment', { type: 'bigint' })
    id: number;

    @Column({ name: 'device_id', type: 'text' })
    deviceId: string;

    @Column({ name: 'incident_id', type: 'bigint' })
    incidentId: number;

    @Column({ type: 'enum', enum: TaskStatus, default: TaskStatus.ACTIVE })
    status: TaskStatus;

    
    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;
}