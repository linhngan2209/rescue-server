import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { MqttConnectionService } from './mqtt-connection.service';
import { MessageHandlersService } from './message-handlers.service';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly mqttConnectionService: MqttConnectionService,
    private readonly messageHandlersService: MessageHandlersService,
  ) { }

  async onModuleInit(): Promise<void> {
    this.mqttConnectionService.setMessageHandler((topic, message) => {
      this.messageHandlersService.handleMessage(topic, message);
    });
    await this.mqttConnectionService.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.mqttConnectionService.disconnect();
  }

  publish(topic: string, payload: object, qos: 0 | 1 = 1): void {
    this.mqttConnectionService.publish(topic, payload, qos);
  }

  @OnEvent('device.danger_zone.entered')
  handleDangerZoneEntered(payload: {
    deviceId: string;
    zoneName: string;
    lat: number;
    lng: number;
    timestamp: string;
  }) {
   
    this.mqttConnectionService.publish(`rescue/commands/${payload.deviceId}`, {
      command: 'danger_zone_warning',
      zoneName: payload.zoneName,
      lat: payload.lat,
      lng: payload.lng,
      timestamp: payload.timestamp,
    });
  }
  isConnected(): boolean {
    return this.mqttConnectionService.isConnected();
  }
}