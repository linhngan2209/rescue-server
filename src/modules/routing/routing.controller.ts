// src/routing/routing.controller.ts

import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { RoutingService } from './routing.service';

@Controller('routing')
export class RoutingController {
  constructor(private readonly routingService: RoutingService) { }

  @Get('danger-zone')
  getDangerZones() {
    return this.routingService.getActiveDangerZones();
  }

  @Delete('danger-zone/:id')
  removeDangerZone(@Param('id', ParseIntPipe) id: number) {
    return this.routingService.removeDangerZone(id);
  }

  @Post('reroute/:entityId/approve')
  approveReroute(@Param('entityId') entityId: string) {
    return this.routingService.approveReroute(entityId);
  }


  @Post('reroute/:entityId/reject')
  rejectReroute(@Param('entityId') entityId: string) {
    return this.routingService.rejectReroute(entityId);
  }

  @Post('graph/reload')
  reloadGraph() {
    return this.routingService.reloadGraph();
  }

  @Post('route-to-rescue')
  routeToRescuePoint(
    @Body() body: {
      originLat: number;
      originLng: number;
      destLat: number;
      destLng: number;
    }
  ) {
    const { originLat, originLng, destLat, destLng } = body;

    return this.routingService.routeToRescuePoint(
      originLat,
      originLng,
      destLat,
      destLng,
    );
  }
}