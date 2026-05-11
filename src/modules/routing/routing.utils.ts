import { LatLng } from 'src/entities/danger_zone.entity';

export function haversine(
    lat1: number, lng1: number,
    lat2: number, lng2: number,
): number {
    const R = 6_371_000;
    const p1 = (lat1 * Math.PI) / 180;
    const p2 = (lat2 * Math.PI) / 180;
    const dp = ((lat2 - lat1) * Math.PI) / 180;
    const dl = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dp / 2) ** 2 +
        Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function pointInPolygon(
    lat: number, lng: number, polygon: LatLng[],
): boolean {
    let inside = false;
    const n = polygon.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
        const [iLat, iLng] = polygon[i];
        const [jLat, jLng] = polygon[j];
        if (
            (iLng > lng) !== (jLng > lng) &&
            lat < ((jLat - iLat) * (lng - iLng)) / (jLng - iLng) + iLat
        )
            inside = !inside;
    }
    return inside;
}

export function makeSquarePolygon(
    lat: number, lng: number, radiusM: number,
): LatLng[] {
    const dLat = radiusM / 111_320;
    const dLng = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180));
    return [
        [lat + dLat, lng - dLng],
        [lat + dLat, lng + dLng],
        [lat - dLat, lng + dLng],
        [lat - dLat, lng - dLng],
    ] as LatLng[];
}

export class MinHeap<T> {
    private d: Array<[number, T]> = [];

    push(p: number, v: T) {
        this.d.push([p, v]);
        this.up(this.d.length - 1);
    }

    pop(): [number, T] | undefined {
        if (!this.d.length) return undefined;
        const top = this.d[0];
        const last = this.d.pop()!;
        if (this.d.length) { this.d[0] = last; this.down(0); }
        return top;
    }

    get size() { return this.d.length; }

    private up(i: number) {
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (this.d[p][0] <= this.d[i][0]) break;
            [this.d[p], this.d[i]] = [this.d[i], this.d[p]];
            i = p;
        }
    }

    private down(i: number) {
        const n = this.d.length;
        while (true) {
            let s = i;
            const l = 2 * i + 1, r = 2 * i + 2;
            if (l < n && this.d[l][0] < this.d[s][0]) s = l;
            if (r < n && this.d[r][0] < this.d[s][0]) s = r;
            if (s === i) break;
            [this.d[s], this.d[i]] = [this.d[i], this.d[s]];
            i = s;
        }
    }
}