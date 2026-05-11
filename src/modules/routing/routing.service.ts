import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ZonesService } from '../zones/zones.service';
import { EventsGateway } from 'src/events/events.gateway';
import { WS_TOPIC, WS_MESSAGE } from 'src/events/events.constants';
import { haversine, makeSquarePolygon, MinHeap, pointInPolygon } from './routing.utils';
import { ActiveUnit, AddDangerZoneResult, RerouteSuggestion } from './routing.types';

export { makeSquarePolygon };

interface GraphNode { lat: number; lng: number }
interface GraphEdge { target: number; distanceM: number; weight: number }
type Graph = Map<number, GraphEdge[]>;

const DANGER_WEIGHT = 999_999;
const DEFAULT_SPEED = 10;
const REROUTABLE_TYPES = new Set(['rescuer', 'ambulance']);

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
  }

  async applyDangerZones(): Promise<number> {
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

    return blocked;
  }

  private nearestNode(lat: number, lng: number): number | null {
    let bestId: number | null = null, bestD = Infinity;
    for (const [id, c] of this.nodeCoords) {
      const d = (c.lat - lat) ** 2 + (c.lng - lng) ** 2;
      if (d < bestD) { bestD = d; bestId = id; }
    }
    return bestId;
  }

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
        if (edge.weight >= DANGER_WEIGHT) continue;
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
        const tg = g + edge.distanceM;
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
            this.logger.warn(`Cannot find nearest node for ${unit.entityId} @ ${unit.originLat},${unit.originLng}`);
            return;
          }

          const oldPath = this.astarIgnoreDanger(srcNode, tgtNode);
          if (!oldPath || !this.isPathBlocked(oldPath)) return;

          const newPath = this.astar(srcNode, tgtNode);
          const oldDist = Math.round(this.pathDistance(oldPath));
          const newDist = newPath ? Math.round(this.pathDistance(newPath)) : 0;
          const extraM = newDist - oldDist;
          const extraS = Math.round(extraM / DEFAULT_SPEED);
          const hasDetour = newPath !== null && newPath.length > 0;

          const message = hasDetour
            ? `${unit.entityId} bị chặn bởi "${zoneName}". Đề xuất lộ trình vòng an toàn: +${extraM}m, +${Math.round(extraS / 60)}p${extraS % 60}s. Chấp nhận?`
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

          this.gateway.sendNotification(
            WS_TOPIC.REROUTE,
            WS_MESSAGE.REROUTE_SUGGESTED,
            { ...suggestion, awaitingApproval: true },
          );
        }),
    );

    return suggestions;
  }

  async addDangerZoneFromUav(
    lat: number,
    lng: number,
    incidentName: string,
    units: ActiveUnit[],
    radiusM = 200,
  ): Promise<AddDangerZoneResult> {
    const saved = await this.zonesService.create({
      name: incidentName,
      coords: makeSquarePolygon(lat, lng, radiusM),
      createdBy: 'uav',
    });

    const [blockedEdges, suggestions] = await Promise.all([
      this.applyDangerZones(),
      this.scanAndSuggestReroutes(units, lat, lng, saved.name),
    ]);

    return { zoneId: saved.id, blockedEdges, suggestions };
  }

  async approveReroute(entityId: string): Promise<void> {
    this.gateway.sendNotification(WS_TOPIC.REROUTE, WS_MESSAGE.REROUTE_APPROVED, { entityId });
  }

  async rejectReroute(entityId: string): Promise<void> {
    this.gateway.sendNotification(WS_TOPIC.REROUTE, WS_MESSAGE.REROUTE_REJECTED, { entityId });
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
  ): Promise<{ route: Array<{ lat: number; lng: number }>; distanceM: number; etaS: number } | null> {
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