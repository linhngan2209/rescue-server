// src/routing/routing.service.ts

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ZonesService } from '../zones/zones.service';
import { LatLng } from 'src/entities/danger_zone.entity';
import { EventsGateway } from 'src/events/events.gateway';
import { WS_TOPIC, WS_MESSAGE } from 'src/events/events.constants';

// ── Types ─────────────────────────────────────────────────────────────

interface GraphNode { lat: number; lng: number }
interface GraphEdge { target: number; distanceM: number; weight: number }
type Graph = Map<number, GraphEdge[]>;

/**
 * Shape chuẩn từ TrackingService.getActiveUnits().
 * TrackingService phải map về đúng các field này trước khi trả về.
 */
export interface ActiveUnit {
  entityId: string;   // deviceId
  originLat: number;   // vị trí hiện tại
  originLng: number;
  destLat?: number;   // điểm đích hiện tại (waypoint đang đi đến), nếu có
  destLng?: number;
}

export interface RerouteSuggestion {
  entityId: string;
  reason: string;
  message: string;   // text hiển thị cho chỉ huy trên dashboard
  oldRoute: Array<{ lat: number; lng: number }>;
  newRoute: Array<{ lat: number; lng: number }>;
  distanceM: number;
  etaS: number;
  extraM: number;
  extraS: number;
  hasDetour: boolean;  // false = không tìm được đường vòng, cần điều phối thủ công
}

export interface AddDangerZoneResult {
  zoneId: number;
  blockedEdges: number;
  suggestions: RerouteSuggestion[];
}

// ── Constants ─────────────────────────────────────────────────────────

const DANGER_WEIGHT = 999_999;
const DEFAULT_SPEED = 10; // m/s

// Chỉ quét những loại entity này khi reroute
// UAV tự navigate, không cần backend tính đường
const REROUTABLE_TYPES = new Set(['rescuer', 'ambulance']);

// ── Geometry ──────────────────────────────────────────────────────────

function haversine(
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

function pointInPolygon(
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
    [lat + dLat, lng - dLng], // tây bắc
    [lat + dLat, lng + dLng], // đông bắc
    [lat - dLat, lng + dLng], // đông nam
    [lat - dLat, lng - dLng], // tây nam
  ] as LatLng[];
}

// ── Min-Heap ──────────────────────────────────────────────────────────

class MinHeap<T> {
  private d: Array<[number, T]> = [];
  push(p: number, v: T) { this.d.push([p, v]); this.up(this.d.length - 1); }
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

// ── Service ───────────────────────────────────────────────────────────

@Injectable()
export class RoutingService implements OnModuleInit {
  private readonly logger = new Logger(RoutingService.name);
  private graph: Graph = new Map();
  private nodeCoords: Map<number, GraphNode> = new Map();
  private isLoaded = false;

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly zonesService: ZonesService,
    private readonly gateway: EventsGateway,
  ) { }

  async onModuleInit() {
    await this.loadGraph();
    await this.applyDangerZones();
  }

  // ── Load graph ───────────────────────────────────────────────────────

  async loadGraph() {
    this.graph.clear();
    this.nodeCoords.clear();

    const nodes = await this.db.query('SELECT id, lat, lng FROM osm_nodes');
    for (const n of nodes) {
      const id = Number(n.id);
      this.nodeCoords.set(id, { lat: +n.lat, lng: +n.lng });
      this.graph.set(id, []);
    }

    const edges = await this.db.query(
      'SELECT source, target, distance_m FROM osm_edges',
    );
    for (const e of edges) {
      const src = Number(e.source);
      if (!this.graph.has(src)) this.graph.set(src, []);
      this.graph.get(src)!.push({
        target: Number(e.target),
        distanceM: +e.distance_m,
        weight: +e.distance_m,
      });
    }

    this.isLoaded = true;
    this.logger.log(
      `Graph loaded: ${this.nodeCoords.size.toLocaleString()} nodes, ` +
      `${edges.length.toLocaleString()} edges`,
    );
  }

  // ── Tái trọng số theo danger zones hiện tại ──────────────────────────

  async applyDangerZones(): Promise<number> {
    // Reset về distanceM gốc
    for (const edges of this.graph.values())
      for (const e of edges) e.weight = e.distanceM;

    const zones = await this.zonesService.findActive();
    if (!zones.length) return 0;

    let blocked = 0;
    for (const [srcId, edges] of this.graph) {
      const src = this.nodeCoords.get(srcId);
      if (!src) continue;
      for (const edge of edges) {
        const tgt = this.nodeCoords.get(edge.target);
        if (!tgt) continue;
        const midLat = (src.lat + tgt.lat) / 2;
        const midLng = (src.lng + tgt.lng) / 2;
        for (const zone of zones) {
          if (pointInPolygon(midLat, midLng, zone.coords)) {
            edge.weight = DANGER_WEIGHT;
            blocked++;
            break;
          }
        }
      }
    }

    this.logger.log(`${blocked} edges blocked by danger zones`);
    return blocked;
  }

  // ── A* helpers ───────────────────────────────────────────────────────

  private nearestNode(lat: number, lng: number): number | null {
    let bestId: number | null = null, bestD = Infinity;
    for (const [id, c] of this.nodeCoords) {
      const d = (c.lat - lat) ** 2 + (c.lng - lng) ** 2;
      if (d < bestD) { bestD = d; bestId = id; }
    }
    return bestId;
  }

  /** A* tránh danger zone (weight cao) */
  private astar(srcId: number, tgtId: number): number[] | null {
    const tgt = this.nodeCoords.get(tgtId);
    if (!tgt) return null;
    const h = (id: number) => {
      const c = this.nodeCoords.get(id);
      return c ? haversine(c.lat, c.lng, tgt.lat, tgt.lng) : 0;
    };
    const heap = new MinHeap<number>();
    const gScore = new Map<number, number>([[srcId, 0]]);
    const cameFrom = new Map<number, number>();
    heap.push(h(srcId), srcId);
    while (heap.size > 0) {
      const [, cur] = heap.pop()!;
      if (cur === tgtId) return this.reconstructPath(cameFrom, tgtId);
      const g = gScore.get(cur) ?? Infinity;
      for (const edge of this.graph.get(cur) ?? []) {
        if (edge.weight >= DANGER_WEIGHT) continue;  // bỏ qua cạnh bị chặn
        const tg = g + edge.weight;
        if (tg < (gScore.get(edge.target) ?? Infinity)) {
          gScore.set(edge.target, tg);
          cameFrom.set(edge.target, cur);
          heap.push(tg + h(edge.target), edge.target);
        }
      }
    }
    return null;
  }

  /** A* KHÔNG tránh danger zone — dùng để tái hiện lộ trình gốc */
  private astarIgnoreDanger(srcId: number, tgtId: number): number[] | null {
    const tgt = this.nodeCoords.get(tgtId);
    if (!tgt) return null;
    const h = (id: number) => {
      const c = this.nodeCoords.get(id);
      return c ? haversine(c.lat, c.lng, tgt.lat, tgt.lng) : 0;
    };
    const heap = new MinHeap<number>();
    const gScore = new Map<number, number>([[srcId, 0]]);
    const cameFrom = new Map<number, number>();
    heap.push(h(srcId), srcId);
    while (heap.size > 0) {
      const [, cur] = heap.pop()!;
      if (cur === tgtId) return this.reconstructPath(cameFrom, tgtId);
      const g = gScore.get(cur) ?? Infinity;
      for (const edge of this.graph.get(cur) ?? []) {
        const tg = g + edge.distanceM;  // dùng distanceM, bỏ qua weight
        if (tg < (gScore.get(edge.target) ?? Infinity)) {
          gScore.set(edge.target, tg);
          cameFrom.set(edge.target, cur);
          heap.push(tg + h(edge.target), edge.target);
        }
      }
    }
    return null;
  }

  private reconstructPath(cameFrom: Map<number, number>, tgtId: number): number[] {
    const path: number[] = [];
    let node: number | undefined = tgtId;
    while (node !== undefined) { path.push(node); node = cameFrom.get(node); }
    return path.reverse();
  }

  private pathDistance(path: number[]): number {
    let total = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const edge = this.graph.get(path[i])?.find(e => e.target === path[i + 1]);
      total += edge?.distanceM ?? 0;
    }
    return total;
  }

  private isPathBlocked(path: number[]): boolean {
    for (let i = 0; i < path.length - 1; i++) {
      const edge = this.graph.get(path[i])?.find(e => e.target === path[i + 1]);
      if (edge && edge.weight >= DANGER_WEIGHT) return true;
    }
    return false;
  }

  private pathToCoords(path: number[]): Array<{ lat: number; lng: number }> {
    return path.map(id => ({ ...this.nodeCoords.get(id)! }));
  }

  // ══════════════════════════════════════════════════════════════════════
  //  CORE: Quét đội đang hoạt động + đề xuất reroute
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Với mỗi đội rescuer/ambulance đang active:
   *   1. Tái hiện lộ trình gốc từ vị trí hiện tại → điểm sự cố
   *   2. Kiểm tra lộ trình đó có đi qua danger zone vừa tạo không
   *   3. Nếu bị chặn → tính A* đường vòng tránh zone
   *   4. Push gợi ý lên dashboard cho chỉ huy duyệt
   *
   * UAV bị bỏ qua vì tự navigate.
   */
  async scanAndSuggestReroutes(
    units: ActiveUnit[],
    destLat: number,
    destLng: number,
    zoneName: string,
  ): Promise<RerouteSuggestion[]> {
    if (!this.isLoaded || !units.length) return [];

    const tgtNode = this.nearestNode(destLat, destLng);
    if (!tgtNode) return [];

    const suggestions: RerouteSuggestion[] = [];

    await Promise.all(
      units
        .filter(u => REROUTABLE_TYPES.has(u.entityId.split('_')[0]))
        .map(async (unit) => {
          const srcNode = this.nearestNode(unit.originLat, unit.originLng);
          if (!srcNode) {
            this.logger.warn(
              `Cannot find nearest node for ${unit.entityId} ` +
              `@ ${unit.originLat},${unit.originLng}`,
            );
            return;
          }

          // ── Bước 1: lộ trình gốc (không tránh danger) ──────────────
          const oldPath = this.astarIgnoreDanger(srcNode, tgtNode);
          if (!oldPath) return;

          // ── Bước 2: có bị chặn không? ───────────────────────────────
          if (!this.isPathBlocked(oldPath)) return;  // không ảnh hưởng

          // ── Bước 3: tính đường vòng ──────────────────────────────────
          const newPath = this.astar(srcNode, tgtNode);  // null nếu không có
          const oldDist = Math.round(this.pathDistance(oldPath));
          const newDist = newPath ? Math.round(this.pathDistance(newPath)) : 0;
          const extraM = newDist - oldDist;
          const extraS = Math.round(extraM / DEFAULT_SPEED);
          const hasDetour = newPath !== null && newPath.length > 0;

          // Message hiển thị trên dashboard cho chỉ huy
          const message = hasDetour
            ? `${unit.entityId} bị chặn bởi "${zoneName}". ` +
            `Đề xuất lộ trình vòng an toàn: +${extraM}m, +${Math.round(extraS / 60)}p${extraS % 60}s. Chấp nhận?`
            : `${unit.entityId} bị chặn bởi "${zoneName}" và KHÔNG tìm được đường vòng. Cần điều phối thủ công!`;

          const suggestion: RerouteSuggestion = {
            entityId: unit.entityId,
            reason: `Lộ trình bị chặn bởi vùng nguy hiểm: ${zoneName}`,
            message,
            oldRoute: this.pathToCoords(oldPath),
            newRoute: hasDetour ? this.pathToCoords(newPath!) : [],
            distanceM: newDist,
            etaS: Math.round(newDist / DEFAULT_SPEED),
            extraM,
            extraS,
            hasDetour,
          };

          suggestions.push(suggestion);

          // ── Bước 4: push lên dashboard, chỉ huy quyết định ──────────
          this.gateway.sendNotification(
            WS_TOPIC.REROUTE,
            WS_MESSAGE.REROUTE_SUGGESTED,
            { ...suggestion, awaitingApproval: true },
          );

        }),
    );

    return suggestions;
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Public API
  // ══════════════════════════════════════════════════════════════════════

  async addDangerZoneFromUav(
    lat: number,
    lng: number,
    incidentName: string,
    units: ActiveUnit[],
    radiusM = 200,
  ): Promise<AddDangerZoneResult> {
    // Lưu danger zone vào DB
    const saved = await this.zonesService.create({
      name: incidentName,
      coords: makeSquarePolygon(lat, lng, radiusM),
      createdBy: 'uav',
    });

    // Tái trọng số graph + quét đội bị ảnh hưởng song song
    const [blockedEdges, suggestions] = await Promise.all([
      this.applyDangerZones(),
      this.scanAndSuggestReroutes(units, lat, lng, saved.name),
    ]);

    return { zoneId: saved.id, blockedEdges, suggestions };
  }

  /** Chỉ huy chấp nhận → frontend dùng newRoute đã có sẵn để vẽ */
  async approveReroute(entityId: string): Promise<void> {
    this.logger.log(`✅ Reroute approved for ${entityId}`);
    this.gateway.sendNotification(
      WS_TOPIC.REROUTE,
      WS_MESSAGE.REROUTE_APPROVED,
      { entityId },
    );
  }

  /** Chỉ huy từ chối → giữ lộ trình cũ, thông báo cho frontend */
  async rejectReroute(entityId: string): Promise<void> {
    this.logger.log(`❌ Reroute rejected for ${entityId}`);
    this.gateway.sendNotification(
      WS_TOPIC.REROUTE,
      WS_MESSAGE.REROUTE_REJECTED,
      { entityId },
    );
  }

  async getActiveDangerZones() {
    return this.zonesService.findActive();
  }

  async removeDangerZone(zoneId: number) {
    await this.zonesService.update(zoneId, { active: false });
    const blockedEdges = await this.applyDangerZones();
    return { zoneId, blockedEdges };
  }

  async reloadGraph() {
    await this.loadGraph();
    await this.applyDangerZones();
    return {
      nodes: this.nodeCoords.size,
      edges: [...this.graph.values()].reduce((s, e) => s + e.length, 0),
    };
  }

  async routeToRescuePoint(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
  ): Promise<{
    route: Array<{ lat: number; lng: number }>;
    distanceM: number;
    etaS: number;
  } | null> {
    if (!this.isLoaded) return null;

    const srcNode = this.nearestNode(originLat, originLng);
    const tgtNode = this.nearestNode(destLat, destLng);

    if (!srcNode || !tgtNode) return null;

    const path = this.astar(srcNode, tgtNode);
    if (!path) return null;

    const distanceM = Math.round(this.pathDistance(path));

    return {
      route: this.pathToCoords(path),
      distanceM,
      etaS: Math.round(distanceM / DEFAULT_SPEED),
    };
  }
}