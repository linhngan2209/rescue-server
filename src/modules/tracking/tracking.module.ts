import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';



import { TrackingService }    from './tracking.service';
import { TrackingController } from './tracking.controller';
import { EventsModule }       from 'src/events/events.module';
import { PositionLog } from 'src/entities/position_log.entity';
import { DangerZone } from 'src/entities/danger_zone.entity';
import { Alert } from 'src/entities/alert.entity';
import { EntitiesModule } from '../devices/devices.module';
import { DeviceStatus } from 'src/entities/device_status.entity';
import { IncidentsModule } from '../incidents/incidents.module';
import { AlgorithmsModule } from '../algorithms/algorithms.module';
import { SignalMonitorService } from './signal_monitor.service';
import { AlertsModule } from '../alerts/alerts.module';
import { TasksModule } from '../task/tasks.module';
import { MqttConnectionService } from '../mqtt/mqtt-connection.service';
import { MqttModule } from '../mqtt/mqtt.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PositionLog, DangerZone, Alert, DeviceStatus]),
    EventsModule, EntitiesModule, IncidentsModule, AlgorithmsModule, AlertsModule, TasksModule,
  ],
  controllers: [TrackingController],
  providers:   [TrackingService, SignalMonitorService],
  exports:     [TrackingService],
})
export class TrackingModule {}