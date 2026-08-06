import { OnApplicationShutdown, OnModuleInit } from "@nestjs/common";
import type { Redis } from "ioredis";
import type { AppConfig } from "../config.js";
import { LogsGateway } from "./logs.gateway.js";
export declare class ExecutionWorker implements OnModuleInit, OnApplicationShutdown {
    private readonly config;
    private readonly database;
    private readonly redis;
    private readonly logs;
    private readonly logger;
    private worker?;
    constructor(config: AppConfig, database: ReturnType<typeof import("@agent-forum/database").createDatabase>, redis: Redis, logs: LogsGateway);
    onModuleInit(): void;
    onApplicationShutdown(): Promise<void>;
}
