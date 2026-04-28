import { Injectable } from '@nestjs/common';
import { MqttConnectionService } from '../mqtt/mqtt-connection.service';
import { EventsGateway } from 'src/events/events.gateway';
import { WS_MESSAGE, WS_TOPIC } from 'src/events/events.constants';

export interface RecallDto {
  deviceId: string;
  lat:      number;
  lng:      number;
}

export interface WarningDto {
  deviceId: string;
  active:   boolean;
}

@Injectable()
export class CommandsService {
  constructor(
    private readonly mqtt: MqttConnectionService,
    private readonly gateway: EventsGateway,
  ) {}

  /**
   * Ra lệnh triệu hồi thực thể về tọa độ chỉ định.
   * MQTT → simulator đổi target.
   * Socket.IO → dashboard hiển thị trạng thái recall.
   */
  recall(dto: RecallDto): void {
    this.mqtt.publish(`rescue/commands/${dto.deviceId}`, {
      cmd: 'recall',
      lat: dto.lat,
      lng: dto.lng,
    });

    this.gateway.sendNotification(WS_TOPIC.ALERT, WS_MESSAGE.RECALLED, {
      deviceId: dto.deviceId,
      targetLat: dto.lat,
      targetLng: dto.lng,
    });
  }

  /** Cho thực thể tiếp tục hành trình bình thường sau recall */
  resume(deviceId: string): void {
    this.mqtt.publish(`rescue/commands/${deviceId}`, { cmd: 'resume' });
  }

  /** Gửi cảnh báo nguy hiểm đến thiết bị (hiện thị terminal simulator) */
  warning(dto: WarningDto): void {
    this.mqtt.publish(`rescue/commands/${dto.deviceId}`, {
      cmd:    'warning',
      active: dto.active,
    });
  }
}