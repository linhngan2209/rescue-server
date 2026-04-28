import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PositionLog } from 'src/entities/position_log.entity';
import { Repository, Between } from 'typeorm';

export interface ReplayQueryDto {
  deviceId?: string;   // undefined = tất cả thiết bị
  from:      string;   // ISO string
  to:        string;   // ISO string
}

@Injectable()
export class ReplayService {
  constructor(
    @InjectRepository(PositionLog)
    private readonly positionRepo: Repository<PositionLog>,
  ) {}

  /**
   * GET /replay?from=&to=&deviceId=
   * Trả về mảng position_logs trong khoảng thời gian,
   * sắp xếp theo timestamp — dashboard dùng để tua lại hành trình.
   */
  async query(dto: ReplayQueryDto): Promise<PositionLog[]> {
    const from = new Date(dto.from);
    const to   = new Date(dto.to);

    const where: any = { timestamp: Between(from, to) };
    if (dto.deviceId) where.deviceId = dto.deviceId;

    return this.positionRepo.find({
      where,
      order: { timestamp: 'ASC' },
    });
  }

  /**
   * GET /replay/summary?from=&to=
   * Tóm tắt nhanh — số điểm, khoảng cách, thời gian trong zone.
   * Dùng cho panel thống kê sau sự cố.
   */
  async summary(from: string, to: string) {
    const logs = await this.query({ from, to });

    // Nhóm theo deviceId
    const grouped = logs.reduce<Record<string, PositionLog[]>>((acc, log) => {
      (acc[log.deviceId] ??= []).push(log);
      return acc;
    }, {});

    return Object.entries(grouped).map(([deviceId, entries]) => {
      const dangerEntries = entries.filter((e) => e.inDanger);
      const totalDist = entries.reduce((sum, e, i) => {
        if (i === 0) return sum;
        const prev = entries[i - 1];
        // Khoảng cách Euclid đơn giản (đủ cho summary)
        const d = Math.sqrt(
          (e.lat - prev.lat) ** 2 + (e.lng - prev.lng) ** 2,
        ) * 111.32; // 1 độ ≈ 111.32km
        return sum + d;
      }, 0);

      return {
        deviceId,
        totalPoints:     entries.length,
        dangerPoints:    dangerEntries.length,
        totalDistKm:     +totalDist.toFixed(2),
        firstSeen:       entries[0]?.timestamp,
        lastSeen:        entries[entries.length - 1]?.timestamp,
      };
    });
  }
}