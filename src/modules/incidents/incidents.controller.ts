import {
    Controller, Get, Post, Patch,
    Param, Body, Query, ParseIntPipe, ParseFloatPipe,
    Delete,
} from '@nestjs/common';
import { IncidentsService, CreateIncidentDto } from './incidents.service';
import { IncidentType } from 'src/entities/incident.entity';

@Controller('incidents')
export class IncidentsController {
    constructor(private readonly service: IncidentsService) { }

    /** GET /incidents — tất cả */
    @Get()
    findAll() { return this.service.findAll(); }

    /** GET /incidents/active — đang active */
    @Get('active')
    findActive() { return this.service.findActive(); }

    /** GET /incidents/type/:type — lọc theo incident | rescue */
    @Get('type/:type')
    findByType(@Param('type') type: IncidentType) {
        return this.service.findByType(type);
    }

    /**
     * GET /incidents/nearest-rescue?lat=&lng=
     * Tìm điểm cứu hộ gần nhất — dashboard và tracking dùng
     */
    @Get('nearest-rescue')
    findNearest(
        @Query('lat', ParseFloatPipe) lat: number,
        @Query('lng', ParseFloatPipe) lng: number,
    ) {
        return this.service.findNearestRescue(lat, lng);
    }

    @Post()
    create(@Body() body: { name: string; lat: number; lng: number; type: IncidentType; description?: string }) {
        return this.service.createManual(body);
    }
    @Get('command-center')
    getCommandCenter() {
        return this.service.getCommandCenter();
    }

    @Post('entity-ping')
    entityPing(@Body() body: { deviceId: string; lat: number; lng: number }) {
        return this.service.createFromEntity(body.deviceId, body.lat, body.lng);
    }

    @Patch(':id/resolve')
    resolve(@Param('id', ParseIntPipe) id: number) {
        return this.service.resolve(id);
    }
    @Delete(':id')
    delete(@Param('id') id: number) {
        return this.service.deleteIncident(id);
    }

}