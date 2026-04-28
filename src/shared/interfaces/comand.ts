
export interface PendingCommand {
    commandId: string;
    actionLogId: number;
    hardwareId: number;
    userId: number;
    commandType: string;
    message: string;
    ip: string;
    sentTime: number;
    timeout: NodeJS.Timeout;
}

export interface QueuedCommand {
    commandId: string;
    actionLogId: number;
    userId: number;
    retryCount: number;
}