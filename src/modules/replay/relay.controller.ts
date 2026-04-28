import { Controller, Get, Query } from '@nestjs/common';
import { ReplayService } from './replay.service';

@Controller('replay')
export class ReplayController {
  constructor(private readonly replayService: ReplayService) {}

  /**
   * GET /replay?from=2024-01-01T10:00:00Z&to=2024-01-01T10:30:00Z&deviceId=AMB_01
   * deviceId là optional — bỏ qua để lấy tất cả thiết bị
   */
  @Get()
  query(
    @Query('from')      from:      string,
    @Query('to')        to:        string,
    @Query('deviceId')  deviceId?: string,
  ) {
    return this.replayService.query({ from, to, deviceId });
  }

  /**
   * GET /replay/summary?from=&to=
   * Tóm tắt diễn biến sau sự cố
   */
  @Get('summary')
  summary(
    @Query('from') from: string,
    @Query('to')   to:   string,
  ) {
    return this.replayService.summary(from, to);
  }
}