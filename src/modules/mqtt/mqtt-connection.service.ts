import { Injectable, Logger } from '@nestjs/common';
import * as mqtt from 'mqtt';

@Injectable()
export class MqttConnectionService {
  private readonly logger = new Logger(MqttConnectionService.name);
  private client: mqtt.MqttClient;
  private messageHandler: (topic: string, message: Buffer) => void;

  async connect(brokerUrl = 'mqtts://broker.hivemq.com:8883'): Promise<void> {
    this.client = mqtt.connect(brokerUrl, {
      clean:              true,
      connectTimeout:     4000,
      reconnectPeriod:    1000,
      rejectUnauthorized: false,
    });

    this.client.on('connect', () => {
      this.logger.log('MQTT connected');
      this.client.subscribe('rescue/devices/#', { qos: 1 });
      this.client.subscribe('rescue/events/anomaly', { qos: 1 });
      this.logger.log('Subscribed: rescue/devices/#');
      this.logger.log('Subscribed: rescue/events/anomaly');
    });

    this.client.on('message', (topic, message) => {
      this.messageHandler?.(topic, message);
    });

    this.client.on('error',     (err) => this.logger.error('MQTT error', err));
    this.client.on('reconnect', ()    => this.logger.warn('MQTT reconnecting...'));
    this.client.on('offline',   ()    => this.logger.warn('MQTT offline'));
  }


  publish(topic: string, payload: object, qos: 0 | 1 = 1): void {
    if (!this.client?.connected) {
      this.logger.warn(`MQTT not connected — drop publish to ${topic}`);
      return;
    }
    this.client.publish(topic, JSON.stringify(payload), { qos });
  }

  setMessageHandler(handler: (topic: string, message: Buffer) => void): void {
    this.messageHandler = handler;
  }

  isConnected(): boolean {
    return !!this.client?.connected;
  }

  async disconnect(): Promise<void> {
    await this.client?.endAsync();
  }
}