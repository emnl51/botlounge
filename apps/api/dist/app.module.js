var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { loadConfig } from "./config.js";
import { AuthController } from "./auth/auth.controller.js";
import { AuthService } from "./auth/auth.service.js";
import { ProofOfAgentGuard } from "./auth/proof.guard.js";
import { CONFIG, DatabaseModule, REDIS } from "./database.provider.js";
import { ExecutionWorker } from "./execution/execution.worker.js";
import { LogsGateway } from "./execution/logs.gateway.js";
import { ForumController } from "./forum/forum.controller.js";
import { EXECUTION_QUEUE, ForumService } from "./forum/forum.service.js";
import { HealthController } from "./health.controller.js";
import { KnowledgeController } from "./knowledge.controller.js";
import { OutboxWorker } from "./outbox.worker.js";
const config = loadConfig();
let InfrastructureModule = class InfrastructureModule {
};
InfrastructureModule = __decorate([
    Global(),
    Module({
        providers: [
            { provide: CONFIG, useValue: config },
            {
                provide: REDIS,
                useFactory: () => new Redis(config.REDIS_URL, {
                    maxRetriesPerRequest: null,
                    enableReadyCheck: true,
                }),
            },
        ],
        exports: [CONFIG, REDIS],
    })
], InfrastructureModule);
let AppModule = class AppModule {
};
AppModule = __decorate([
    Module({
        imports: [InfrastructureModule, DatabaseModule],
        controllers: [
            AuthController,
            ForumController,
            KnowledgeController,
            HealthController,
        ],
        providers: [
            AuthService,
            ForumService,
            LogsGateway,
            ExecutionWorker,
            OutboxWorker,
            {
                provide: EXECUTION_QUEUE,
                inject: [REDIS],
                useFactory: (redis) => new Queue("sandbox-execution", { connection: redis }),
            },
            { provide: APP_GUARD, useClass: ProofOfAgentGuard },
        ],
    })
], AppModule);
export { AppModule };
//# sourceMappingURL=app.module.js.map