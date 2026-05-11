
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceTask, TaskStatus } from 'src/entities/device_task.entity';
import { Incident, IncidentStatus } from 'src/entities/incident.entity';
import { EventsGateway } from 'src/events/events.gateway';
import { WS_TOPIC, WS_MESSAGE } from 'src/events/events.constants';
import { ActiveUnitTask } from './tasks.types';

@Injectable()
export class TasksService {
    constructor(
        @InjectRepository(DeviceTask)
        private readonly taskRepo: Repository<DeviceTask>,

        @InjectRepository(Incident)
        private readonly incidentRepo: Repository<Incident>,

        private readonly gateway: EventsGateway,
    ) { }

    async assign(deviceId: string, incidentId: number): Promise<DeviceTask> {
        const incident = await this.incidentRepo.findOne({ where: { id: incidentId } });
        if (!incident) throw new NotFoundException(`Incident ${incidentId} not found`);
        if (incident.status !== IncidentStatus.ACTIVE)
            throw new BadRequestException(`Incident ${incidentId} is not active`);

        await this.taskRepo.update(
            { deviceId, status: TaskStatus.ACTIVE },
            { status: TaskStatus.CANCELLED },
        );

        const task = this.taskRepo.create({
            deviceId,
            incidentId,
            status: TaskStatus.ACTIVE,
        });
        const saved = await this.taskRepo.save(task);

        this.gateway.sendNotification(WS_TOPIC.TASK, WS_MESSAGE.TASK_ASSIGNED, {
            taskId: saved.id,
            deviceId,
            incidentId,
            destLat: incident.lat,
            destLng: incident.lng,
            destName: incident.name,
            incidentType: incident.type,
        });

        return saved;
    }


    async updateStatus(taskId: number, status: TaskStatus.COMPLETED | TaskStatus.CANCELLED): Promise<DeviceTask> {
        const task = await this.taskRepo.findOne({ where: { id: taskId } });
        if (!task) throw new NotFoundException(`Task ${taskId} not found`);
        if (task.status !== TaskStatus.ACTIVE)
            throw new BadRequestException(`Task ${taskId} is already ${task.status}`);

        task.status = status;
        const saved = await this.taskRepo.save(task);

        this.gateway.sendNotification(WS_TOPIC.TASK, WS_MESSAGE.TASK_UPDATED, {
            taskId: saved.id,
            deviceId: saved.deviceId,
            status,
        });

        return saved;
    }


    async findActive(): Promise<Array<DeviceTask & { incident: Incident }>> {
        return this.taskRepo
            .createQueryBuilder('t')
            .innerJoinAndMapOne(
                't.incident',
                Incident,
                'i',
                'i.id = t.incident_id',
            )
            .where('t.status = :s', { s: TaskStatus.ACTIVE })
            .andWhere('i.status = :is', { is: IncidentStatus.ACTIVE })
            .andWhere('i.type = :type', { type: 'rescue' })
            .orderBy('t.created_at', 'DESC')
            .getMany() as any;
    }
    async findByDevice(deviceId: string): Promise<DeviceTask[]> {
        return this.taskRepo.find({
            where: { deviceId },
            order: { createdAt: 'DESC' },
            take: 10,
        });
    }


    async getActiveUnitTasks(): Promise<ActiveUnitTask[]> {
        const rows: {
            device_id: string;
            dest_lat: number;
            dest_lng: number;
        }[] = await this.taskRepo.query(`
      SELECT t.device_id, i.lat AS dest_lat, i.lng AS dest_lng
      FROM device_tasks t
      JOIN incidents i ON i.id = t.incident_id
      WHERE t.status  = 'active'
        AND i.status  = 'active'
    `);

        return rows.map(r => ({
            entityId: r.device_id,
            originLat: 0,
            originLng: 0,
            destLat: +r.dest_lat,
            destLng: +r.dest_lng,
        }));
    }
}