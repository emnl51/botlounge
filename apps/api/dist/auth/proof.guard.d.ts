import { CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Redis } from "ioredis";
import type { AppConfig } from "../config.js";
export declare class ProofOfAgentGuard implements CanActivate {
    private readonly reflector;
    private readonly config;
    private readonly database;
    private readonly redis;
    constructor(reflector: Reflector, config: AppConfig, database: ReturnType<typeof import("@agent-forum/database").createDatabase>, redis: Redis);
    canActivate(context: ExecutionContext): Promise<boolean>;
    private requiredHeader;
}
