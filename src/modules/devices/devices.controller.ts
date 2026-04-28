import {
  Body, Controller, Get, Patch, Param, Post,
  Delete,
} from '@nestjs/common';
import {
  EntitiesService, CreateDeviceDto, UpdateDeviceDto,
} from './devices.service';

@Controller('devices')
export class EntitiesController {
  constructor(private readonly service: EntitiesService) { }

  @Post()
  create(@Body() body: CreateDeviceDto) {
    return this.service.create(body);
  }

  @Get()
  getAll() {
    return this.service.findAll();
  }
  @Get('positions')
  async getPositions() {
    return this.service.getPositionDevice();
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Delete('delete-device/:id')
  async deleteDevice(@Param('id') id: string): Promise<void> {
    await this.service.deleteDevice(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdateDeviceDto,
  ) {
    return this.service.update(id, body);
  }

  @Patch(':id/active')
  setActive(
    @Param('id') id: string,
    @Body('active') active: boolean,
  ) {
    return this.service.setActive(id, active);
  }
}