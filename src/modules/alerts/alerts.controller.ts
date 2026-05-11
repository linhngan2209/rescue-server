import {
  Controller, Get, Patch,
  Param, Query, ParseIntPipe,
  Post,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { AlertType } from 'src/entities/alert.entity';

@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) { }

  @Get()
  findAll(@Query('limit') limit?: string) {
    return this.alertsService.findAll(limit ? +limit : 50);
  }
  @Post()
  async create(@Body() body: any) {
    const { deviceId, type } = body;

    if (!deviceId || typeof deviceId !== 'string') {
      throw new BadRequestException('deviceId must be a string');
    }

    if (!Object.values(AlertType).includes(type)) {
      throw new BadRequestException('type is invalid');
    }

    return this.alertsService.createAlert({
      deviceId,
      type
    });
  }
  @Get('unresolved')
  findUnresolved() {
    return this.alertsService.findUnresolved();
  }

  @Get('device/:deviceId')
  findByDevice(@Param('deviceId') deviceId: string) {
    return this.alertsService.findByDevice(deviceId);
  }

  @Patch(':id/resolve')
  resolve(@Param('id', ParseIntPipe) id: number) {
    return this.alertsService.resolve(id);
  }
}