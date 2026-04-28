import { Injectable, Logger, OnModuleInit, forwardRef, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

// tọa độ trung tâm
import { IncidentsService } from '../incidents/incidents.service';
import { PositionLog } from 'src/entities/position_log.entity';
import { DangerZone } from 'src/entities/danger_zone.entity';
import { Alert, AlertType } from 'src/entities/alert.entity';
import { WS_MESSAGE, WS_TOPIC } from 'src/events/events.constants';
import { DeviceType } from 'src/entities/device.entity';
import { DeviceStatus } from 'src/entities/device_status.entity';
import { EventsGateway } from 'src/events/events.gateway';
import { EntitiesService } from '../devices/devices.service';
import { AlgorithmsService } from '../algorithms/algorithms.service';
import { ActiveUnit } from '../routing/routing.service';
import { DeviceTask } from 'src/entities/device_task.entity';
import { TasksService } from '../task/tasks.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

const MIN_DIST_KM = 0.03;

const REDIS_KEY = {
  state: (id: string) => `device:state:${id}`,
  zones: 'zones:active',
} as const;

const REDIS_TTL = { state: 300, zones: 3600 } as const;



export interface RawGpsDto {
  deviceId: string;
  lat: number;
  lng: number;
  speed: number;
  status?: string;
  battery?: number;
  timestamp: Date;
}

export interface DeviceState {
  id: string;
  lat: number;
  lng: number;
  inDanger: boolean;
}

@Injectable()
export class TrackingService implements OnModuleInit {
  private readonly logger = new Logger(TrackingService.name);
  private activeZones: DangerZone[] = [];

  constructor(
    @InjectRedis()
    private readonly redis: Redis,

    @InjectRepository(PositionLog)
    private readonly positionRepo: Repository<PositionLog>,

    @InjectRepository(DangerZone)
    private readonly zoneRepo: Repository<DangerZone>,

    @InjectRepository(Alert)
    private readonly alertRepo: Repository<Alert>,

    @InjectRepository(DeviceStatus)
    private readonly statusRepo: Repository<DeviceStatus>,


    private readonly algorithms: AlgorithmsService,
    private readonly gateway: EventsGateway,
    private readonly entitiesService: EntitiesService,
    private readonly incidentService: IncidentsService,
    private readonly tasksService: TasksService,
    private readonly eventEmitter: EventEmitter2,

    @Inject(forwardRef(() => IncidentsService))
    private readonly incidentsService: IncidentsService,
  ) { }

  async onModuleInit(): Promise<void> {
    const keys = await this.redis.keys('device:state:*');
    if (keys.length) {
      await this.redis.del(...keys);
      this.logger.log(`Cleared ${keys.length} stale device states from Redis`);
    }
    await this.warmRedisFromDb();
    await this.reloadZones();
  }

  private async warmRedisFromDb(): Promise<void> {
    const statuses = await this.statusRepo.find();
    for (const s of statuses) {
      await this.setState(s.deviceId, {
        id: s.deviceId, lat: s.lastLat, lng: s.lastLng, inDanger: false,
      });
    }
    this.logger.log(`Warmed Redis with ${statuses.length} LKP entries`);
  }

  async reloadZones(): Promise<void> {
    this.activeZones = await this.zoneRepo.find({ where: { active: true } });
    await this.redis.set(REDIS_KEY.zones, JSON.stringify(this.activeZones), 'EX', REDIS_TTL.zones);
    this.logger.log(`Loaded ${this.activeZones.length} active zone(s)`);
  }

  async pingWarning(deviceId: string): Promise<void> {
    const state = await this.getState(deviceId);
    const zone = this.activeZones.find(z =>
      state ? this.algorithms.pointInPolygon(state.lat, state.lng, z.coords) : false
    );
    this.eventEmitter.emit('device.danger_zone.entered', {
      deviceId,
      zoneName: zone?.name ?? 'Cảnh báo thủ công',
      lat: state?.lat ?? 0,
      lng: state?.lng ?? 0,
      timestamp: new Date().toISOString(),
    });
    this.logger.warn(`[PING-MANUAL] Warning sent to ${deviceId}`);
  }

  async handleRawGps(dto: RawGpsDto): Promise<void> {
    const { deviceId, lat, lng, speed, timestamp } = dto;
    await this.entitiesService.upsertFromGps(deviceId, this.inferType(deviceId));


    const prev = await this.getState(deviceId);
    const center = await this.incidentService.getCommandCenter();
    const distToIncident = this.algorithms.haversine(lat, lng, center.lat, center.lng);

    const matchedZone = this.activeZones.find((z) =>
      this.algorithms.pointInPolygon(lat, lng, z.coords),
    );


    const inDanger = !!matchedZone;

    const stateChanged = prev ? prev.inDanger !== inDanger : true;
    const movedSignificantly = prev
      ? this.algorithms.haversine(prev.lat, prev.lng, lat, lng) > MIN_DIST_KM
      : true;

    if (stateChanged || movedSignificantly) {
      await this.positionRepo.save({
        deviceId, lat, lng, speed, inDanger,
        distToIncident: +distToIncident.toFixed(3),
        timestamp,
      });
    }


    if (stateChanged && prev !== null) {
      const alertType = inDanger ? AlertType.ENTERED : AlertType.EXITED;
      const wsMessage = inDanger ? WS_MESSAGE.ENTERED_ZONE : WS_MESSAGE.EXITED_ZONE;

      const alert = await this.alertRepo.save({
        deviceId,
        zoneId: matchedZone?.id ?? undefined,
        type: alertType,
        resolved: false,
      });

      this.gateway.sendNotification(WS_TOPIC.ALERT, wsMessage, {
        alertId: alert.id,
        deviceId,
        zoneName: matchedZone?.name ?? null,
        type: alertType,
        lat, lng, status: dto.status, battery: dto.battery,
        timestamp: timestamp.toISOString(),
      });
      if (inDanger) {
        console.log('[EVENT-EMIT] Emitting danger_zone.entered for', deviceId);

        this.eventEmitter.emit('device.danger_zone.entered', {
          deviceId,
          zoneName: matchedZone?.name ?? 'unknown',
          lat,
          lng,
          timestamp: timestamp.toISOString(),
        });
      }


      this.logger.warn(`[ALERT] ${deviceId} ${alertType} | zone: ${matchedZone?.name ?? 'n/a'}`);
    }

    await Promise.all([
      this.setState(deviceId, { id: deviceId, lat, lng, inDanger }),
      this.upsertDeviceStatus(deviceId, lat, lng, inDanger, timestamp),
    ]);


    let nearestRescue: {
      id?: number;
      name: string;
      lat: number;
      lng: number;
      distanceKm: number;
      type: 'point' | 'entity';
    } | null = null;

    if (inDanger) {
      const nearest = await this.incidentsService.findNearestRescue(lat, lng);
      if (nearest) {
        nearestRescue = {
          id: nearest.point.id,
          name: nearest.point.name,
          lat: nearest.point.lat,
          lng: nearest.point.lng,
          distanceKm: nearest.distanceKm,
          type: 'point',
        };
      } else {
        const allStates = await this.getAllStates();
        const nearestEntity = this.algorithms.findNearestRescue(lat, lng, allStates);
        if (nearestEntity) {
          nearestRescue = {
            name: nearestEntity.id,
            lat: nearestEntity.lat,
            lng: nearestEntity.lng,
            distanceKm: +this.algorithms.haversine(lat, lng, nearestEntity.lat, nearestEntity.lng).toFixed(3),
            type: 'entity',
          };
        }
      }
    }

    this.gateway.sendNotification(WS_TOPIC.TRACKING, WS_MESSAGE.DEVICE_UPDATE, {
      deviceId, lat, lng, speed, inDanger,
      distToIncident: +distToIncident.toFixed(3),
      nearestRescue,
      incidentPos: { lat: center.lat, lng: center.lng, name: center.name },
      timestamp: timestamp.toISOString(),
    });
  }

  private async upsertDeviceStatus(
    deviceId: string, lat: number, lng: number,
    inDanger: boolean, timestamp: Date,
  ): Promise<void> {
    await this.statusRepo.upsert(
      { deviceId, lastLat: lat, lastLng: lng, inDanger, lastSeen: timestamp },
      { conflictPaths: ['deviceId'] },
    );
  }

  async getAllStates(): Promise<DeviceState[]> {
    const keys = await this.redis.keys('device:state:*');
    if (keys.length > 0) {
      const values = await this.redis.mget(...keys);
      return values.filter((v): v is string => v !== null).map((v) => JSON.parse(v));
    }
    const statuses = await this.statusRepo.find();
    return statuses.map((s) => ({ id: s.deviceId, lat: s.lastLat, lng: s.lastLng, inDanger: s.inDanger }));
  }

  private async getState(deviceId: string): Promise<DeviceState | null> {
    const raw = await this.redis.get(REDIS_KEY.state(deviceId));
    return raw ? JSON.parse(raw) : null;
  }

  private async setState(deviceId: string, state: DeviceState): Promise<void> {
    await this.redis.set(REDIS_KEY.state(deviceId), JSON.stringify(state), 'EX', REDIS_TTL.state);
  }

  private inferType(deviceId: string, entityType?: string): DeviceType {
    if (entityType) {
      const map: Record<string, DeviceType> = {
        uav: DeviceType.UAV,
        rescuer: DeviceType.RESCUER,
        ambulance: DeviceType.AMBULANCE,
      };
      return map[entityType] ?? DeviceType.RESCUER;
    }
    if (deviceId.startsWith('AMB')) return DeviceType.AMBULANCE;
    if (deviceId.startsWith('UAV')) return DeviceType.UAV;
    return DeviceType.RESCUER;
  }
  async getActiveUnits(): Promise<Array<{
    entityId: string;
    originLat: number;
    originLng: number;
    destLat: number;
    destLng: number;
  }>> {
    const unitTasks = await this.tasksService.getActiveUnitTasks();
    if (!unitTasks.length) return [];

    const states = await this.getAllStates();
    const stateMap = new Map(states.map(s => [s.id, s]));

    return unitTasks
      .filter(t => stateMap.has(t.entityId))
      .map(t => ({
        entityId: t.entityId,
        originLat: stateMap.get(t.entityId)!.lat,
        originLng: stateMap.get(t.entityId)!.lng,
        destLat: t.destLat,
        destLng: t.destLng,
      }));
  }
}