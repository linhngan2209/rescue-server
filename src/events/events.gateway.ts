// src/events/events.gateway.ts
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway()
export class EventsGateway {
  @WebSocketServer()
  server: Server;

  sendNotification(topic: number, messageType: number, data: any) {
    this.server.emit('notification', {
      topic,
      message: messageType,
      data
    });
  }
}