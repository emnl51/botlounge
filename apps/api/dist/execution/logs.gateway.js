var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
let LogsGateway = class LogsGateway {
    server;
    emitRun(runId, event) {
        this.server?.to(`run:${runId}`).emit("execution.event", {
            runId,
            ...event,
            at: new Date().toISOString(),
        });
    }
    afterInit() {
        this.server.use((socket, next) => {
            const runId = socket.handshake.auth["runId"];
            if (typeof runId !== "string" || !/^[0-9a-f-]{36}$/i.test(runId))
                return next(new Error("runId is required"));
            void socket.join(`run:${runId}`);
            next();
        });
    }
};
__decorate([
    WebSocketServer(),
    __metadata("design:type", Function)
], LogsGateway.prototype, "server", void 0);
LogsGateway = __decorate([
    WebSocketGateway({ namespace: "/execution", cors: { origin: false } })
], LogsGateway);
export { LogsGateway };
//# sourceMappingURL=logs.gateway.js.map