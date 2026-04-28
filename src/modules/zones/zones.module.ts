import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ZonesService } from './zones.service';
import { ZonesController } from './zones.controller';
import { TrackingModule } from '../tracking/tracking.module';
import { MqttModule } from '../mqtt/mqtt.module';
import { DangerZone } from 'src/entities/danger_zone.entity';
import { AlertsModule } from '../alerts/alerts.module';
import { Alert } from 'src/entities/alert.entity';
import { RoutingModule } from '../routing/routing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DangerZone, Alert]),
    TrackingModule,
    forwardRef(() => RoutingModule)
  ],
  controllers: [ZonesController],
  providers: [ZonesService],
  exports: [ZonesService],
})
export class ZonesModule {}