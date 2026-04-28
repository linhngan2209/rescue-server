export interface QueueStatus {
    pendingCommand: {
        commandId: number;
        commandType: string;
    } | null;
    solicitedResponseReceived: boolean; }