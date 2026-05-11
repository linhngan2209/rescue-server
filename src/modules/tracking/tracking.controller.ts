import { Body, Controller, Get, Post } from '@nestjs/common';
import { TrackingService } from './tracking.service';

@Controller('tracking')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) { }

  @Get('states')
  async getStates() {
    return this.trackingService.getAllStates();
  }

  @Post('ping-warning')
  async pingWarning(@Body() body: { deviceId: string }) {
    await this.trackingService.pingWarning(body.deviceId);
    return { ok: true };
  }
}