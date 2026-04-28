import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisModule } from '@nestjs-modules/ioredis';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { EntitiesModule } from './modules/devices/devices.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { MapModule } from './modules/map/map.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { EventsModule } from './events/events.module';

import { getDatabaseConfig } from './config/database.config';
import { redisConfig } from './config/redis-cache.config';
import { ResponseTimeMiddleware } from './common/middleware/response-time.middleware';
import { MqttModule } from './modules/mqtt/mqtt.module';
import { ZonesModule } from './modules/zones/zones.module';
import { ReplayModule } from './modules/replay/replay.module';
import { In } from 'typeorm';
import { IncidentsModule } from './modules/incidents/incidents.module';
import { ScheduleModule } from '@nestjs/schedule';
import { RoutingModule } from './modules/routing/routing.module';
import { TasksModule } from './modules/task/tasks.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: getDatabaseConfig,
    }),
    RedisModule.forRootAsync(redisConfig),
    EventsModule,
    EntitiesModule,
    TrackingModule,
    MapModule,
    AlertsModule,
    MqttModule,
    ZonesModule,
    ReplayModule,
    IncidentsModule,
    RoutingModule,
    TasksModule
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ResponseTimeMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}