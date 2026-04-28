import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EntitiesController } from './devices.controller';
import { EntitiesService } from './devices.service';
import { Device } from 'src/entities/device.entity';
import { DeviceStatus } from 'src/entities/device_status.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Device, DeviceStatus])],
    controllers: [EntitiesController],
    providers: [EntitiesService],
    exports: [EntitiesService],
})
export class EntitiesModule { }