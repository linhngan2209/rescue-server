import { DeviceType } from "src/entities/device.entity";

export interface CreateDeviceDto {
    id: string;
    type: DeviceType;
    description?: string;
    step?: number;
    intervalS?: number;
}

export interface UpdateDeviceDto {
    description?: string;
    step?: number;
    intervalS?: number;
    active?: boolean;
}