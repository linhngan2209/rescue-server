import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, ParseIntPipe,
} from '@nestjs/common';
import { ZonesService, CreateZoneDto, UpdateZoneDto } from './zones.service';
import { RoutingService } from '../routing/routing.service';

@Controller('zones')
export class ZonesController {
  constructor(
    private readonly zonesService: ZonesService,
    private readonly routingService: RoutingService,
  ) {}

  @Get()
  findAll() {
    return this.zonesService.findAll();
  }

  @Get('active')
  findActive() {
    return this.zonesService.findActive();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.zonesService.findOne(id);
  }

  @Post()
  async create(@Body() dto: CreateZoneDto) {
    const result = await this.zonesService.create(dto);

    // 👉 chạy background, không block API
    this.routingService.applyDangerZones();

    return result;
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateZoneDto,
  ) {
    const result = await this.zonesService.update(id, dto);

    this.routingService.applyDangerZones();

    return result;
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const result = await this.zonesService.remove(id);

    this.routingService.applyDangerZones();

    return result;
  }
}