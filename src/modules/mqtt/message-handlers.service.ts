// src/message-handlers/message-handlers.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { TrackingService } from '../tracking/tracking.service';
import { IncidentsService } from '../incidents/incidents.service';
import { EventsGateway } from 'src/events/events.gateway';
import { WS_MESSAGE, WS_TOPIC } from 'src/events/events.constants';
import { AlertType } from 'src/entities/alert.entity';
import { AlertsService } from '../alerts/alerts.service';
import { RoutingService } from '../routing/routing.service';

const INCIDENT_TYPE = {
  INCIDENT: 'incident',
  RESCUE: 'rescue',
  SOS: 'sos',
} as const;

@Injectable()
export class MessageHandlersService {
  private readonly logger = new Logger(MessageHandlersService.name);

  constructor(
    private readonly trackingService: TrackingService,
    private readonly incidentsService: IncidentsService,
    private readonly alertsService: AlertsService,
    private readonly gateway: EventsGateway,
    private readonly routingService: RoutingService,
  ) { }

  async handleMessage(topic: string, message: Buffer): Promise<void> {
    try {
      const data = JSON.parse(message.toString());

      // ═══════════════════════════════════════════════
      // 1. DEVICE GPS STREAM
      // ═══════════════════════════════════════════════
      if (topic.startsWith('rescue/devices/')) {
        const deviceId = topic.split('/')[2];
        if (!deviceId) return;

        const lat = data.lat ?? data.la;
        const lng = data.lng ?? data.lo;
        if (lat == null || lng == null) return;

        await this.trackingService.handleRawGps({
          deviceId,
          lat, lng,
          speed: data.speed ?? data.s ?? 0,
          status: data.status,
          battery: data.battery,
          timestamp: data.timestamp
            ? new Date(data.timestamp * 1000)
            : new Date(),
        });
        return;
      }

      // ═══════════════════════════════════════════════
      // 2. ANOMALY
      // ═══════════════════════════════════════════════
      if (topic === 'rescue/events/anomaly') {
        const { deviceId, type, lat, lng, desc, uavLat, uavLng } = data;
        if (!deviceId || lat == null || lng == null) return;

        // Map type → AlertType lưu DB
        const alertTypeMap: Record<string, AlertType> = {
          [INCIDENT_TYPE.INCIDENT]: AlertType.ENTITY_INCIDENT,
          [INCIDENT_TYPE.RESCUE]: AlertType.ENTITY_RESCUE,
          [INCIDENT_TYPE.SOS]: AlertType.ENTITY_SOS,
        };
        const alertType = alertTypeMap[type] ?? AlertType.ENTITY_INCIDENT;

        // Map type → WS_MESSAGE gửi frontend
        const wsMessageMap: Record<string, number> = {
          [INCIDENT_TYPE.INCIDENT]: WS_MESSAGE.ENTITY_INCIDENT,
          [INCIDENT_TYPE.RESCUE]: WS_MESSAGE.ENTITY_RESCUE,
          [INCIDENT_TYPE.SOS]: WS_MESSAGE.ENTITY_SOS,
        };
        const wsMessage = wsMessageMap[type] ?? WS_MESSAGE.ENTITY_INCIDENT;

        // ── SOS: xử lý trước, KHÔNG tạo incident trong DB ───────────────
        // Rescuer/ambulance bản thân gặp nguy → chỉ alert khẩn
        // Không liên quan địa lý → không tạo zone, không reroute
        if (type === INCIDENT_TYPE.SOS) {
          this.logger.warn(`🆘 SOS from ${deviceId} @ ${lat},${lng}: ${desc}`);
          const alert = await this.alertsService.createAlert({ deviceId, type: alertType });
          this.gateway.sendNotification(WS_TOPIC.ALERT, wsMessage, {
            alertId: alert.id,
            deviceId,
            type: alertType,
            lat, lng,
            desc,
            timestamp: new Date().toISOString(),
          });
          return;
        }

        // ── RESCUE / INCIDENT: tạo incident trong DB ────────────────────
        // Source tự xác định từ prefix deviceId:
        //   UAV_* → IncidentSource.UAV
        //   RES_* / AMB_* → IncidentSource.ENTITY
        const [saved, alert] = await Promise.all([
          this.incidentsService.createFromMqtt({
            deviceId,
            incidentType: type,
            lat, lng,
            desc,
          }),
          this.alertsService.createAlert({ deviceId, type: alertType }),
        ]);

        const basePayload = {
          alertId: alert.id,
          incidentId: saved.id,
          deviceId,
          type: alertType,
          lat, lng,
          desc,
          uavLat, uavLng,
          timestamp: saved.createdAt.toISOString(),
        };

        // ── RESCUE: điểm cần cứu hộ ─────────────────────────────────────
        // Có người cần giúp → thông báo dashboard để chỉ huy điều phối
        // Không nguy hiểm địa lý → không tạo zone, không block đường
        if (type === INCIDENT_TYPE.RESCUE) {
          this.logger.log(`🟡 Rescue point from ${deviceId} @ ${lat},${lng}: ${desc}`);
          this.gateway.sendNotification(WS_TOPIC.ALERT, wsMessage, basePayload);
          this.gateway.sendNotification(WS_TOPIC.INCIDENT, wsMessage, basePayload);
          return;
        }

        // ── INCIDENT: sự cố nguy hiểm địa lý ────────────────────────────
        // Tạo danger zone + block đường + quét đội bị ảnh hưởng + reroute
        const activeUnits = await this.trackingService.getActiveUnits();

        const { zoneId, blockedEdges, suggestions } =
          await this.routingService.addDangerZoneFromUav(
            lat, lng,
            `incident_${saved.id}`,
            activeUnits,
          );

        this.logger.log(
          `🔴 Zone ${zoneId} | ${blockedEdges} edges blocked | ` +
          `${suggestions.length} đội cần reroute`,
        );

        this.gateway.sendNotification(WS_TOPIC.ALERT, wsMessage, {
          ...basePayload, zoneId, blockedEdges, affectedUnits: suggestions.length,
        });
        this.gateway.sendNotification(WS_TOPIC.INCIDENT, wsMessage, {
          ...basePayload, zoneId, blockedEdges, affectedUnits: suggestions.length,
        });
        return;
      }

      this.logger.warn(`Unhandled topic: ${topic}`);
    } catch (e) {
      this.logger.error(`handleMessage error [${topic}]`, e);
    }
  }
}