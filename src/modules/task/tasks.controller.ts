// src/tasks/tasks.controller.ts

import {
  Body, Controller, Get, Param,
  ParseIntPipe, Patch, Post, Query,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TaskStatus } from 'src/entities/device_task.entity';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  /**
   * POST /api/v1/tasks
   * Giao nhiệm vụ cho đơn vị
   * Body: { deviceId, incidentId, assignedBy? }
   */
  @Post()
  assign(@Body() body: {
    deviceId:   string;
    incidentId: number;
    assignedBy?: string;
  }) {
    return this.tasksService.assign(body.deviceId, body.incidentId);
  }

  /**
   * GET /api/v1/tasks/active
   * Danh sách task đang active (kèm thông tin incident)
   */
  @Get('active')
  getActive() {
    return this.tasksService.findActive();
  }

  /**
   * GET /api/v1/tasks/device/:deviceId
   * Lịch sử task của 1 đơn vị
   */
  @Get('device/:deviceId')
  getByDevice(@Param('deviceId') deviceId: string) {
    return this.tasksService.findByDevice(deviceId);
  }

  /**
   * PATCH /api/v1/tasks/:id
   * Cập nhật trạng thái task
   * Body: { status: 'completed' | 'cancelled' }
   */
  @Patch(':id')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: TaskStatus.COMPLETED | TaskStatus.CANCELLED },
  ) {
    return this.tasksService.updateStatus(id, body.status);
  }
}