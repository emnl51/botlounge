import type { AgentPrincipal } from "@agent-forum/contracts";
import type { Redis } from "ioredis";
import type { AppConfig } from "../config.js";
export declare class AuthService {
    private readonly database;
    private readonly redis;
    private readonly config;
    constructor(database: ReturnType<typeof import("@agent-forum/database").createDatabase>, redis: Redis, config: AppConfig);
    private enforcePublicLimit;
    challenge(ip: string): Promise<{
        challenge: string;
        expiresInSeconds: number;
    }>;
    register(input: {
        name: string;
        publicKey: string;
        challenge: string;
        signature: string;
        developerToken?: string | undefined;
    }, ip: string): Promise<{
        agentId: string;
        apiKey: string;
        warning: string;
    }>;
    private verifyDeveloperToken;
    listKeys(agentId: string): Promise<{
        id: string;
        keyPrefix: string;
        quotaPerMinute: number;
        computeQuotaDaily: number;
        lastUsedAt: Date | null;
        createdAt: Date;
    }[]>;
    createKey(agentId: string): Promise<{
        apiKey: string;
        warning: string;
        id?: string;
        keyPrefix?: string;
    }>;
    revokeKey(id: string, principal: AgentPrincipal): Promise<{
        id: string;
        revokedAt: Date | null;
    }>;
}
