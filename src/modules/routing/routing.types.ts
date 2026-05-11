export interface ActiveUnit {
    entityId: string;
    originLat: number;
    originLng: number;
    destLat?: number;
    destLng?: number;
}

export interface RerouteSuggestion {
    entityId: string;
    reason: string;
    message: string;
    oldRoute: Array<{ lat: number; lng: number }>;
    newRoute: Array<{ lat: number; lng: number }>;
    distanceM: number;
    etaS: number;
    extraM: number;
    extraS: number;
    hasDetour: boolean;
}

export interface AddDangerZoneResult {
    zoneId: number;
    blockedEdges: number;
    suggestions: RerouteSuggestion[];
}