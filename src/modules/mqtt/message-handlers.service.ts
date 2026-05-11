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
          timestamp: data.timestamp ? new Date(data.timestamp * 1000) : new Date(),
        });
        return;
      }

      if (topic === 'rescue/events/anomaly') {
        const { deviceId, type, lat, lng, desc, uavLat, uavLng } = data;
        if (!deviceId || lat == null || lng == null) return;

        const alertTypeMap: Record<string, AlertType> = {
          [INCIDENT_TYPE.INCIDENT]: AlertType.ENTITY_INCIDENT,
          [INCIDENT_TYPE.RESCUE]: AlertType.ENTITY_RESCUE,
          [INCIDENT_TYPE.SOS]: AlertType.ENTITY_SOS,
        };

        const wsMessageMap: Record<string, number> = {
          [INCIDENT_TYPE.INCIDENT]: WS_MESSAGE.ENTITY_INCIDENT,
          [INCIDENT_TYPE.RESCUE]: WS_MESSAGE.ENTITY_RESCUE,
          [INCIDENT_TYPE.SOS]: WS_MESSAGE.ENTITY_SOS,
        };

        const alertType = alertTypeMap[type] ?? AlertType.ENTITY_INCIDENT;
        const wsMessage = wsMessageMap[type] ?? WS_MESSAGE.ENTITY_INCIDENT;

        if (type === INCIDENT_TYPE.SOS) {
          this.logger.warn(`SOS from ${deviceId} @ ${lat},${lng}: ${desc}`);
          const alert = await this.alertsService.createAlert({ deviceId, type: alertType });
          this.gateway.sendNotification(WS_TOPIC.ALERT, wsMessage, {
            alertId: alert.id,
            deviceId, type: alertType,
            lat, lng, desc,
            timestamp: new Date().toISOString(),
          });
          return;
        }

        const [saved, alert] = await Promise.all([
          this.incidentsService.createFromMqtt({ deviceId, incidentType: type, lat, lng, desc }),
          this.alertsService.createAlert({ deviceId, type: alertType }),
        ]);

        const basePayload = {
          alertId: alert.id,
          incidentId: saved.id,
          deviceId, type: alertType,
          lat, lng, desc,
          uavLat, uavLng,
          timestamp: saved.createdAt.toISOString(),
        };

        if (type === INCIDENT_TYPE.RESCUE) {
          this.gateway.sendNotification(WS_TOPIC.ALERT, wsMessage, basePayload);
          this.gateway.sendNotification(WS_TOPIC.INCIDENT, wsMessage, basePayload);
          return;
        }

        const activeUnits = await this.trackingService.getActiveUnits();
        const { zoneId, blockedEdges, suggestions } = await this.routingService.addDangerZoneFromUav(
          lat, lng,
          `incident_${saved.id}`,
          activeUnits,
        );

        const incidentPayload = { ...basePayload, zoneId, blockedEdges, affectedUnits: suggestions.length };
        this.gateway.sendNotification(WS_TOPIC.ALERT, wsMessage, incidentPayload);
        this.gateway.sendNotification(WS_TOPIC.INCIDENT, wsMessage, incidentPayload);
        return;
      }

      this.logger.warn(`Unhandled topic: ${topic}`);
    } catch (e) {
      this.logger.error(`handleMessage error [${topic}]`, e);
    }
  }
}