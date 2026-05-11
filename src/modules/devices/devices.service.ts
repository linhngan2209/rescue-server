import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Not, Repository } from 'typeorm';
import { Device, DeviceType } from 'src/entities/device.entity';
import { PositionLog } from 'src/entities/position_log.entity';
import { DeviceStatus } from 'src/entities/device_status.entity';
import { Alert } from 'src/entities/alert.entity';
import { CreateDeviceDto, UpdateDeviceDto } from './devices.types';


@Injectable()
export class EntitiesService {
    constructor(

        private readonly dataSource: DataSource,

        @InjectRepository(Device)
        private readonly repo: Repository<Device>,
        @InjectRepository(DeviceStatus)
        private readonly repoStatus: Repository<DeviceStatus>,) { }

    async create(dto: CreateDeviceDto): Promise<Device> {
        const id = dto.id.toUpperCase();

        await this.repo.upsert(
            {
                id,
                type: dto.type,
                description: dto.description ?? '',
                active: true,
            },
            ['id'],
        );

        return this.repo.findOneByOrFail({ id });
    }

    async findAll(): Promise<Device[]> {
        return this.repo.find({ order: { id: 'ASC' } });
    }

    async findOne(deviceId: string): Promise<Device | null> {
        return this.repo.findOneBy({ id: deviceId });
    }

    async update(id: string, dto: UpdateDeviceDto): Promise<Device> {
        await this.repo.update({ id }, dto);
        return this.repo.findOne({ where: { id } }) as Promise<Device>;
    }

    async setActive(id: string, active: boolean): Promise<Device> {
        await this.repo.update({ id }, { active });
        return this.repo.findOne({ where: { id } }) as Promise<Device>;
    }

    async deleteDevice(id: string): Promise<void> {
        await this.dataSource.transaction(async (manager) => {
            const device = await manager.findOne(Device, { where: { id } });

            if (!device) {
                throw new NotFoundException(`Device ${id} not found`);
            }

            await manager.delete(DeviceStatus, { deviceId: id });
            await manager.delete(PositionLog, { deviceId: id });
            await manager.delete(Alert, { deviceId: id });

            await manager.delete(Device, { id });
        });
    }

    async upsertFromGps(deviceId: string, type: DeviceType) {
        await this.repo
            .createQueryBuilder()
            .insert()
            .into(this.repo.target)
            .values({ id: deviceId, type, active: true })
            .onConflict(`("id") DO UPDATE SET 
      type = EXCLUDED.type,
      active = true
    `)
            .execute();
    }

    async getPositionDevice(): Promise<{ deviceId: string; lat: number; lng: number }[]> {
        return this.repoStatus.find({
            select: ['deviceId', 'lastLat', 'lastLng'],
            where: {
                lastLat: Not(IsNull()),
                lastLng: Not(IsNull()),
            },
        }).then(statuses =>
            statuses.map(s => ({
                deviceId: s.deviceId,
                lat: s.lastLat,
                lng: s.lastLng,
            })),
        );
    }
}