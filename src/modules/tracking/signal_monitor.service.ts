import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceStatus } from 'src/entities/device_status.entity';
import { AlertsService } from '../alerts/alerts.service';
import { EventsGateway } from 'src/events/events.gateway';
import { WS_TOPIC, WS_MESSAGE } from 'src/events/events.constants';
import { AlertType } from 'src/entities/alert.entity';

const LOST_THRESHOLD_MS = 30_000;

@Injectable()
export class SignalMonitorService {
  private readonly logger = new Logger(SignalMonitorService.name);
  private readonly signalState = new Map<string, 'online' | 'lost'>();

  constructor(
    @InjectRepository(DeviceStatus)
    private readonly statusRepo: Repository<DeviceStatus>,
    private readonly alertsService: AlertsService,
    private readonly gateway: EventsGateway,
  ) {}

  @Interval(10_000)
  async checkSignals(): Promise<void> {
    const statuses = await this.statusRepo.find();
    const now = Date.now();

    for (const s of statuses) {
      const diff = now - new Date(s.lastSeen).getTime();
      const isLost = diff > LOST_THRESHOLD_MS;
      const prev = this.signalState.get(s.deviceId);

      if (isLost && prev !== 'lost') {
        this.signalState.set(s.deviceId, 'lost');
        this.logger.warn(
          `[SIGNAL_LOST] ${s.deviceId} — no data for ${Math.round(diff / 1000)}s`,
        );
        await this.alertsService.createAlert({
          deviceId: s.deviceId,
          type: AlertType.SIGNAL_LOST,
        });
        this.gateway.sendNotification(WS_TOPIC.SIGNAL, WS_MESSAGE.SIGNAL_LOST, {
          deviceId: s.deviceId,
          lat: s.lastLat,
          lng: s.lastLng,
        });
      }

      if (!isLost && prev === 'lost') {
        this.signalState.set(s.deviceId, 'online');
        this.logger.log(
          `[SIGNAL_RECOVERED] ${s.deviceId} — back online`,
        );
        await this.alertsService.createAlert({
          deviceId: s.deviceId,
          type: AlertType.SIGNAL_RECOVERED,
      
        });
        this.gateway.sendNotification(WS_TOPIC.SIGNAL, WS_MESSAGE.SIGNAL_RECOVERED, {
          deviceId: s.deviceId,
          lat: s.lastLat,
          lng: s.lastLng,
        });
      }

      if (!isLost && prev === undefined) {
        this.signalState.set(s.deviceId, 'online');
      }
    }
  }
}