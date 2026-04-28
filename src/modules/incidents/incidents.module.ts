import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IncidentsService }   from './incidents.service';
import { IncidentsController } from './incidents.controller';
import { Incident } from 'src/entities/incident.entity';
import { TrackingModule } from '../tracking/tracking.module';
import { AlgorithmsModule } from '../algorithms/algorithms.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Incident]), AlgorithmsModule
  ],
  controllers: [IncidentsController],
  providers: [IncidentsService],
  exports: [IncidentsService],
})
export class IncidentsModule {}