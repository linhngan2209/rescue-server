
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceTask } from 'src/entities/device_task.entity';
import { Incident } from 'src/entities/incident.entity';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { EventsModule } from 'src/events/events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DeviceTask, Incident]),
    EventsModule,
  ],
  providers: [TasksService],
  controllers: [TasksController],
  exports: [TasksService],
})
export class TasksModule { }