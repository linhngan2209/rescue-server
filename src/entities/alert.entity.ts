import {
    Entity, PrimaryGeneratedColumn, Column,
    CreateDateColumn, Index,
} from 'typeorm';

export enum AlertType {
    ENTERED = 'entered',
    EXITED = 'exited',
    RECALLED = 'recalled',
    ENTITY_INCIDENT = 'entity_incident',
    ENTITY_RESCUE = 'entity_rescue',
    ENTITY_SOS = 'entity_sos',
    SIGNAL_LOST = 'signal_lost',
    SIGNAL_RECOVERED = 'signal_recovered',
}

@Entity('alerts')
@Index(['timestamp'])
@Index(['deviceId'])
export class Alert {
    @PrimaryGeneratedColumn('increment', { type: 'bigint' })
    id: number;

    @Column({ name: 'device_id', type: 'text' })
    deviceId: string;

    @Column({ name: 'zone_id', type: 'bigint', nullable: true })
    zoneId?: number | undefined;

    @Column({ type: 'enum', enum: AlertType })
    type: AlertType;

    @Column({ type: 'boolean', default: false })
    resolved: boolean;

    @CreateDateColumn({ type: 'timestamptz' })
    timestamp: Date;
}