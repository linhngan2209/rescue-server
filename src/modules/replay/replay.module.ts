import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReplayService } from './replay.service';
import { ReplayController } from './relay.controller';
import { PositionLog } from 'src/entities/position_log.entity';
import { PositionCleanupService } from './position-clean.service';

@Module({
  imports:     [TypeOrmModule.forFeature([PositionLog])],
  controllers: [ReplayController],
  providers:   [ReplayService, PositionCleanupService],
})
export class ReplayModule {}