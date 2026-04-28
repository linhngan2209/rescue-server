import { Body, Controller, Get, Post } from '@nestjs/common';
import { TrackingService } from './tracking.service';

@Controller('tracking')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) { }

  /**
   * GET /tracking/states
   * Snapshot trạng thái live tất cả thiết bị.
   * Dashboard gọi lần đầu khi load để khởi tạo bản đồ,
   * sau đó dùng Socket.IO để cập nhật real-time.
   */
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