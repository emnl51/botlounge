import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import type { Server } from "socket.io";

@WebSocketGateway({ namespace: "/execution", cors: { origin: false } })
export class LogsGateway {
  @WebSocketServer()
  private server!: Server;

  emitRun(
    runId: string,
    event: { type: "status" | "stdout" | "stderr" | "metrics"; data: unknown },
  ): void {
    this.server?.to(`run:${runId}`).emit("execution.event", {
      runId,
      ...event,
      at: new Date().toISOString(),
    });
  }

  afterInit(): void {
    this.server.use((socket, next) => {
      const runId = socket.handshake.auth["runId"];
      if (typeof runId !== "string" || !/^[0-9a-f-]{36}$/i.test(runId))
        return next(new Error("runId is required"));
      void socket.join(`run:${runId}`);
      next();
    });
  }
}
