import {
    Controller, Get, Post, Patch, Delete,
    Param, Body, Query, ParseIntPipe, ParseFloatPipe,
} from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { IncidentType } from 'src/entities/incident.entity';

@Controller('incidents')
export class IncidentsController {
    constructor(private readonly service: IncidentsService) { }

    @Get()
    findAll() { return this.service.findAll(); }

    @Get('active')
    findActive() { return this.service.findActive(); }

    @Get('command-center')
    getCommandCenter() { return this.service.getCommandCenter(); }

    @Get('nearest-rescue')
    findNearest(
        @Query('lat', ParseFloatPipe) lat: number,
        @Query('lng', ParseFloatPipe) lng: number,
    ) { return this.service.findNearestRescue(lat, lng); }

    @Get('type/:type')
    findByType(@Param('type') type: IncidentType) { return this.service.findByType(type); }

    @Post()
    create(@Body() body: { name: string; lat: number; lng: number; type: IncidentType; description?: string }) {
        return this.service.createManual(body);
    }

    @Post('entity-ping')
    entityPing(@Body() body: { deviceId: string; lat: number; lng: number }) {
        return this.service.createFromEntity(body.deviceId, body.lat, body.lng);
    }

    @Patch(':id/resolve')
    resolve(@Param('id', ParseIntPipe) id: number) { return this.service.resolve(id); }

    @Delete(':id')
    delete(@Param('id') id: number) { return this.service.deleteIncident(id); }
}