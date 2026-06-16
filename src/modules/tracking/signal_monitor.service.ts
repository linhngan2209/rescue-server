import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceStatus } from 'src/entities/device_status.entity';
import { AlertsService } from '../alerts/alerts.service';
import { EventsGateway } from 'src/events/events.gateway';
import { WS_TOPIC, WS_MESSAGE } from 'src/events/events.constants';
import { AlertType } from 'src/entities/alert.entity';

const WEAK_THRESHOLD_MS = 5_000;
const LOST_THRESHOLD_MS = 10_000;

type SignalState = 'online' | 'weak' | 'lost';

@Injectable()
export class SignalMonitorService {
  private readonly logger = new Logger(SignalMonitorService.name);
  private readonly signalState = new Map<string, SignalState>();

  constructor(
    @InjectRepository(DeviceStatus)
    private readonly statusRepo: Repository<DeviceStatus>,
    private readonly alertsService: AlertsService,
    private readonly gateway: EventsGateway,
  ) { }

  @Interval(4_000)
  async checkSignals(): Promise<void> {
    const statuses = await this.statusRepo.find();
    const now = Date.now();

    for (const s of statuses) {
      const diff = now - new Date(s.lastSeen).getTime();
      const isLost = diff > LOST_THRESHOLD_MS;
      const isWeak = !isLost && diff > WEAK_THRESHOLD_MS;
      const prev = this.signalState.get(s.deviceId);
      this.logger.log(`[CHECK] ${s.deviceId} diff=${Math.round(diff / 1000)}s prev=${prev} isWeak=${isWeak} isLost=${isLost}`);

      const payload = { deviceId: s.deviceId, lat: s.lastLat, lng: s.lastLng };

      // ── LOST ────────────────────────────────────────────────────
      if (isLost && prev !== 'lost') {
        this.signalState.set(s.deviceId, 'lost');
        this.logger.warn(`[SIGNAL_LOST] ${s.deviceId} — no data for ${Math.round(diff / 1000)}s`);
        await this.alertsService.createAlert({ deviceId: s.deviceId, type: AlertType.SIGNAL_LOST });
        this.gateway.sendNotification(WS_TOPIC.SIGNAL, WS_MESSAGE.SIGNAL_LOST, payload);
        continue;
      }

      // ── WEAK ────────────────────────────────────────────────────
      if (isWeak && prev !== 'weak') {
        this.signalState.set(s.deviceId, 'weak');
        this.logger.warn(`[SIGNAL_WEAK] ${s.deviceId} — weak for ${Math.round(diff / 1000)}s`);
        this.gateway.sendNotification(WS_TOPIC.SIGNAL, WS_MESSAGE.SIGNAL_WEAK, payload);
        continue;
      }

      // ── RECOVERED ───────────────────────────────────────────────
      if (!isLost && !isWeak) {
        if (prev === 'lost' || prev === 'weak') {
          this.signalState.set(s.deviceId, 'online');
          this.logger.log(`[SIGNAL_RECOVERED] ${s.deviceId} — back online`);
          await this.alertsService.createAlert({ deviceId: s.deviceId, type: AlertType.SIGNAL_RECOVERED });
          this.gateway.sendNotification(WS_TOPIC.SIGNAL, WS_MESSAGE.SIGNAL_RECOVERED, payload);
        } else if (prev === undefined) {
          this.signalState.set(s.deviceId, 'online');
        }
      }
    }
  }
}