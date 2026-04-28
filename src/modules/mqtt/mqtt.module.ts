import { Module } from '@nestjs/common';
import { forwardRef } from '@nestjs/common';
import { MqttService } from './mqtt.service';
import { MqttConnectionService } from './mqtt-connection.service';
import { MessageHandlersService } from './message-handlers.service';
import { TrackingModule } from '../tracking/tracking.module';
import { AlertsModule } from '../alerts/alerts.module';
import { IncidentsModule } from '../incidents/incidents.module';
import { RoutingModule } from '../routing/routing.module';

@Module({
  imports: [
    forwardRef(() => TrackingModule),  
    AlertsModule,
    IncidentsModule,
    RoutingModule,
  ],
  providers: [MqttService, MqttConnectionService, MessageHandlersService],
  exports: [MqttConnectionService, MqttService],
})
export class MqttModule {}