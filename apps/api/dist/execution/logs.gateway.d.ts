export declare class LogsGateway {
    private server;
    emitRun(runId: string, event: {
        type: "status" | "stdout" | "stderr" | "metrics";
        data: unknown;
    }): void;
    afterInit(): void;
}
