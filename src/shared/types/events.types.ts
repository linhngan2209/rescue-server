export interface PendingCommand {
  id: string;
  hardwareId: number;
  timerId: number;
  sentTime: Date;
  expectedResponse: any;
  timeout: NodeJS.Timeout;
  userId: number;
  actionLogId: number;
}

export interface HardwareResponseEvent {
  hardwareId: number;
  timerId: number;
  data: any;
  receivedTime: Date;
  rawData: string;
}

export interface CommandResponseEvent extends HardwareResponseEvent {
  commandId: string;
  isSuccess: boolean;
  actionLogId: number;
  
}

export interface CommandTrackingInfo {
    id: string;
    hardwareId: number;
    sentTime: Date;
    expectedResponse: any;
    timeout: NodeJS.Timeout;
    userId: number;
    actionLogId: number;
    commandType: string;
}

export interface CommandResponseEventStatus {
    commandId: string;
    isSuccess: boolean;
    actionLogId: number;
    hardwareId: number;
    responseData?: any;
}

export interface HardwareNotificationStatus {
    hardwareId: number;
    type: string;
    message: string;
    data?: any;
    timestamp: Date;
}