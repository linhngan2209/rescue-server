import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PositionLog } from 'src/entities/position_log.entity';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class PositionCleanupService {
    constructor(
        @InjectRepository(PositionLog)
        private readonly repo: Repository<PositionLog>,
    ) { }


    @Cron('0 0 * * * *')
    async cleanup(): Promise<void> {
        const count = await this.repo.count();

        if (count <= 10000) return;

        const result = await this.repo.query(`
      SELECT id
      FROM position_logs
      ORDER BY id DESC
      OFFSET 10000 LIMIT 1
    `);

        if (!result.length) return;

        const thresholdId = result[0].id;

        await this.repo.query(
            `
      DELETE FROM position_logs
      WHERE id < $1
      `,
            [thresholdId],
        );
    }
}