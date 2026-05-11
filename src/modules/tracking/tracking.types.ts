export interface RawGpsDto {
  deviceId: string;
  lat: number;
  lng: number;
  speed: number;
  status?: string;
  battery?: number;
  timestamp: Date;
}

export interface DeviceState {
  id: string;
  lat: number;
  lng: number;
  inDanger: boolean;
}
