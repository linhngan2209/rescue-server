import { Controller, Post, Body, Param } from '@nestjs/common';
import { CommandsService, RecallDto, WarningDto } from './commands.service';

@Controller('commands')
export class CommandsController {
  constructor(private readonly commandsService: CommandsService) {}

  /**
   * POST /commands/recall
   * Body: { deviceId, lat, lng }
   * Dashboard gọi khi người chỉ huy muốn kéo thực thể về vị trí an toàn
   */
  @Post('recall')
  recall(@Body() dto: RecallDto) {
    this.commandsService.recall(dto);
    return { success: true, message: `Recall sent to ${dto.deviceId}` };
  }

  /**
   * POST /commands/resume/:deviceId
   * Cho thực thể tiếp tục hành trình sau khi recall
   */
  @Post('resume/:deviceId')
  resume(@Param('deviceId') deviceId: string) {
    this.commandsService.resume(deviceId);
    return { success: true, message: `Resume sent to ${deviceId}` };
  }

  /**
   * POST /commands/warning
   * Body: { deviceId, active: true/false }
   */
  @Post('warning')
  warning(@Body() dto: WarningDto) {
    this.commandsService.warning(dto);
    return { success: true, message: `Warning ${dto.active ? 'ON' : 'OFF'} → ${dto.deviceId}` };
  }
}