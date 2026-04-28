import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DangerZone } from 'src/entities/danger_zone.entity';
import { Repository } from 'typeorm';

@Injectable()
export class MapService {
  constructor(@InjectRepository(DangerZone) private repo: Repository<DangerZone>) {}

  async checkInDanger(lat: number, lng: number) {
    const query = `
      SELECT name FROM rescue.danger_zones 
      WHERE ST_Contains(boundary, ST_SetSRID(ST_Point($1, $2), 4326))
    `;
    const result = await this.repo.query(query, [lng, lat]); // PostGIS: (lng, lat)
    return result.length > 0 ? result[0].name : null;
  }
}