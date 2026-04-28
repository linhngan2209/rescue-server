import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TrackingService } from '../tracking/tracking.service';
import { DangerZone, LatLng } from 'src/entities/danger_zone.entity';
import { Alert } from 'src/entities/alert.entity';

export interface CreateZoneDto {
  name: string;
  coords: LatLng[];
  createdBy?: string;
}

export interface UpdateZoneDto {
  name?: string;
  coords?: LatLng[];
  active?: boolean;
}

@Injectable()
export class ZonesService {
  constructor(
    @InjectRepository(DangerZone)
    private readonly zoneRepo: Repository<DangerZone>,

    @InjectRepository(Alert)
    private readonly alertRepo: Repository<Alert>,

    private readonly trackingService: TrackingService,
  ) {}

  async findAll(): Promise<DangerZone[]> {
    return this.zoneRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findActive(): Promise<DangerZone[]> {
    return this.zoneRepo.find({ where: { active: true } });
  }

  async findOne(id: number): Promise<DangerZone> {
    const zone = await this.zoneRepo.findOne({ where: { id } });
    if (!zone) throw new NotFoundException(`Zone ${id} not found`);
    return zone;
  }

  async create(dto: CreateZoneDto): Promise<DangerZone> {
    const zone = this.zoneRepo.create({
      name: dto.name,
      coords: dto.coords,
      createdBy: dto.createdBy ?? 'dashboard',
      active: true,
    });

    const saved = await this.zoneRepo.save(zone);
    await this.syncZones();

    return saved;
  }

  async update(id: number, dto: UpdateZoneDto): Promise<DangerZone> {
    const zone = await this.findOne(id);

    Object.assign(zone, dto);

    const saved = await this.zoneRepo.save(zone);
    await this.syncZones();

    return saved;
  }

  async remove(id: number): Promise<void> {
    const zone = await this.findOne(id);

    await this.alertRepo.delete({ zoneId: id });
    await this.zoneRepo.remove(zone);

    await this.syncZones();
  }

  /**
   * Sau mỗi thay đổi zone:
   * → chỉ reload cache tracking
   */
  private async syncZones(): Promise<void> {
    await this.trackingService.reloadZones();
  }
}