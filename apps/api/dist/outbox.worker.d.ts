import { OnApplicationShutdown, OnModuleInit } from "@nestjs/common";
import type { AppConfig } from "./config.js";
export declare class OutboxWorker implements OnModuleInit, OnApplicationShutdown {
    private readonly config;
    private readonly database;
    private readonly logger;
    private timer?;
    private processing;
    constructor(config: AppConfig, database: ReturnType<typeof import("@agent-forum/database").createDatabase>);
    onModuleInit(): void;
    onApplicationShutdown(): void;
    private drain;
    private claimOne;
    private dispatch;
    private indexResolvedThread;
}
