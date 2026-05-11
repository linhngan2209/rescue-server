import { IncidentSource, IncidentType } from "src/entities/incident.entity";

export interface CreateIncidentDto {
  name?: string;
  lat: number;
  lng: number;
  type: IncidentType;
  source: IncidentSource;
  reportedBy?: string;
  description?: string;
}

export interface CreateFromMqttDto {
  deviceId: string;
  incidentType: string;
  lat: number;
  lng: number;
  desc: string;
}