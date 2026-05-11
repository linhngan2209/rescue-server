import { Injectable } from '@nestjs/common';
import { LatLng } from 'src/entities/danger_zone.entity';

export interface EntitySnapshot {
  id:       string;
  lat:      number;
  lng:      number;
  inDanger: boolean;
}

@Injectable()
export class AlgorithmsService {
  
  haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R    = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }


  pointInPolygon(lat: number, lng: number, polygon: LatLng[]): boolean {
    const n = polygon.length;
    let inside = false;
    let j = n - 1;

    for (let i = 0; i < n; i++) {
      const [xi, yi] = polygon[i];
      const [xj, yj] = polygon[j];

      if ((yi > lng) !== (yj > lng)) {
        const denom = yj - yi;
        if (denom !== 0) {
          const xIntersect = ((xj - xi) * (lng - yi)) / denom + xi;
          if (lat < xIntersect) inside = !inside;
        }
      }
      j = i;
    }
    return inside;
  }

  findNearestRescue(
    dangerLat: number,
    dangerLng: number,
    entities: EntitySnapshot[],
  ): EntitySnapshot | null {
    const candidates = entities.filter((e) => !e.inDanger);
    if (!candidates.length) return null;

    return candidates.reduce((nearest, curr) => {
      const dNearest = this.haversine(dangerLat, dangerLng, nearest.lat, nearest.lng);
      const dCurr    = this.haversine(dangerLat, dangerLng, curr.lat, curr.lng);
      return dCurr < dNearest ? curr : nearest;
    });
  }

  private toRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }
}