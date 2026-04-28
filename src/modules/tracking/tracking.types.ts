// src/modules/tracking/tracking.types.ts
export interface DeviceState {
  id:       string;
  lat:      number;
  lng:      number;
  inDanger: boolean;
}

export interface RawGpsDto {
  deviceId:  string;
  lat:       number;
  lng:       number;
  speed:     number;
  timestamp: Date;
}