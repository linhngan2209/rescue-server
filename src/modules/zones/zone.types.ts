import { LatLng } from "src/entities/danger_zone.entity";

export interface CreateZoneDto {
    name: string;
    coords: LatLng[];
    createdBy?: string;
}

export interface UpdateZoneDto {
    name?: string;
    coords?: LatLng[];
    active?: boolean;
}