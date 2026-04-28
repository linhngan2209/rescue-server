import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MapService } from './map.service';
import { DangerZone } from 'src/entities/danger_zone.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DangerZone])],
  providers: [MapService],
  exports: [MapService], 
})
export class MapModule {}