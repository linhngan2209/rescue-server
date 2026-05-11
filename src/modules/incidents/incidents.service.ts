import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Incident, IncidentSource, IncidentStatus, IncidentType } from 'src/entities/incident.entity';
import { AlgorithmsService } from '../algorithms/algorithms.service';
import { CreateFromMqttDto } from './incidents.types';


@Injectable()
export class IncidentsService {
  constructor(
    @InjectRepository(Incident)
    private readonly repo: Repository<Incident>,
    private readonly algorithms: AlgorithmsService,
  ) { }

  findAll() {
    return this.repo.find({
      where: { type: Not(IncidentType.CENTER) },
      order: { createdAt: 'DESC' },
    });
  }

  findActive() {
    return this.repo.find({
      where: { status: IncidentStatus.ACTIVE, type: Not(IncidentType.CENTER) },
      order: { createdAt: 'DESC' },
    });
  }

  async getCommandCenter(): Promise<{ name: string; lat: number; lng: number }> {
    const center = await this.repo.findOneBy({ type: IncidentType.CENTER });
    if (!center) return { name: 'Trung tâm chỉ huy', lat: 21.5948, lng: 105.8406 };
    return center;
  }

  findByType(type: IncidentType) {
    return this.repo.find({
      where: { type, status: IncidentStatus.ACTIVE },
      order: { createdAt: 'DESC' },
    });
  }

  create(dto: any): Promise<Incident> {
    return this.repo.save({
      name: dto.name ?? `Incident @ ${dto.lat},${dto.lng}`,
      lat: dto.lat,
      lng: dto.lng,
      type: dto.type,
      source: dto.source,
      reportedBy: dto.reportedBy ?? null,
      description: dto.description ?? null,
      status: IncidentStatus.ACTIVE,
    });
  }

  createFromMqtt(dto: CreateFromMqttDto): Promise<Incident> {
    const source = dto.deviceId.startsWith('UAV') ? IncidentSource.UAV : IncidentSource.ENTITY;
    const isRescue = dto.incidentType === 'rescue';

    return this.create({
      name: `${isRescue ? 'Điểm cứu hộ' : 'Điểm sự cố'} [${dto.deviceId}]`,
      lat: dto.lat,
      lng: dto.lng,
      type: isRescue ? IncidentType.RESCUE : IncidentType.INCIDENT,
      source,
      reportedBy: dto.deviceId,
      description: dto.desc,
    });
  }

  /** @deprecated */
  createFromUav(deviceId: string, lat: number, lng: number, desc: string): Promise<Incident> {
    return this.createFromMqtt({ deviceId, incidentType: 'incident', lat, lng, desc });
  }

  /** @deprecated */
  createFromEntity(deviceId: string, lat: number, lng: number): Promise<Incident> {
    return this.createFromMqtt({ deviceId, incidentType: 'rescue', lat, lng, desc: '' });
  }

  async createManual(dto: any): Promise<Incident> {
    return this.repo.manager.transaction(async (manager) => {
      const repo = manager.getRepository(Incident);

      if (dto.type === IncidentType.CENTER) {
        await manager.query(`SELECT pg_advisory_xact_lock(1001)`);
        const existing = await repo.findOneBy({ type: IncidentType.CENTER });
        if (existing) return repo.save({ ...existing, ...dto });
      }

      return repo.save({ ...dto, source: IncidentSource.MANUAL });
    });
  }

  async resolve(id: number): Promise<Incident | null> {
    await this.repo.update(id, { status: IncidentStatus.RESOLVED, resolvedAt: new Date() });
    return this.repo.findOne({ where: { id } });
  }

  async deleteIncident(id: number): Promise<void> {
    const incident = await this.repo.findOneBy({ id });
    if (!incident) throw new Error(`Incident ${id} not found`);
    await this.repo.delete({ id });
  }

  async findNearestRescue(lat: number, lng: number) {
    const rescuePoints = await this.findByType(IncidentType.RESCUE);
    if (!rescuePoints.length) return null;

    let nearest = rescuePoints[0];
    let minDist = this.algorithms.haversine(lat, lng, nearest.lat, nearest.lng);

    for (const p of rescuePoints.slice(1)) {
      const d = this.algorithms.haversine(lat, lng, p.lat, p.lng);
      if (d < minDist) { minDist = d; nearest = p; }
    }

    return { point: nearest, distanceKm: +minDist.toFixed(3) };
  }
}