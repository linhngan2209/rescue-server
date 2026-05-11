import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Alert, AlertType } from 'src/entities/alert.entity';
import { Repository } from 'typeorm';

@Injectable()
export class AlertsService {
  constructor(
    @InjectRepository(Alert)
    private readonly alertRepo: Repository<Alert>,
  ) { }

  async findAll(limit = 50): Promise<any[]> {
    return this.alertRepo
      .createQueryBuilder('alert')
      .leftJoinAndMapOne(
        'alert.zone',
        'danger_zones',
        'zone',
        'zone.id = alert.zone_id',
      )
      .leftJoinAndMapOne(
        'alert.device',
        'devices',
        'device',
        'device.id = alert.device_id',
      )
      .orderBy('alert.timestamp', 'DESC')
      .take(limit)
      .getMany();
  }

  async findUnresolved(): Promise<Alert[]> {
    return this.alertRepo.find({
      where: { resolved: false },
      relations: ['device', 'zone'],
      order: { timestamp: 'DESC' },
    });
  }

  async findByDevice(deviceId: string): Promise<Alert[]> {
    return this.alertRepo.find({
      where: { deviceId },
      relations: ['zone'],
      order: { timestamp: 'DESC' },
      take: 20,
    });
  }

  async createAlert(data: {
    deviceId: string;
    zoneId?: number;
    type: AlertType;

  }): Promise<Alert> {
    const alert = this.alertRepo.create({
      deviceId: data.deviceId,
      zoneId: data.zoneId,
      type: data.type,
      resolved: false,
    });

    return await this.alertRepo.save(alert);
  }

  async resolve(id: number): Promise<Alert> {
    const alert = await this.alertRepo.findOne({ where: { id } });
    if (!alert) throw new NotFoundException(`Alert ${id} not found`);
    alert.resolved = true;
    return this.alertRepo.save(alert);
  }

  async resolveByDevice(deviceId: string): Promise<void> {
    await this.alertRepo.update(
      { deviceId, resolved: false },
      { resolved: true },
    );
  }
}