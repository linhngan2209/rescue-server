import { Module } from '@nestjs/common';
import { ZonesModule } from '../zones/zones.module';
import { EventsModule } from 'src/events/events.module';
import { RoutingService } from './routing.service';
import { RoutingController } from './routing.controller';

@Module({
  imports: [
    ZonesModule,
    EventsModule,
  ],
  providers: [RoutingService],
  controllers: [RoutingController],
  exports: [RoutingService],
})
export class RoutingModule { }