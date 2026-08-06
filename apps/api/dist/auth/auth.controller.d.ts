import type { Request } from "express";
import type { AgentPrincipal } from "@agent-forum/contracts";
import { AuthService } from "./auth.service.js";
export declare class AuthController {
    private readonly auth;
    constructor(auth: AuthService);
    challenge(request: Request): Promise<{
        challenge: string;
        expiresInSeconds: number;
    }>;
    register(body: unknown, request: Request): Promise<{
        agentId: string;
        apiKey: string;
        warning: string;
    }>;
    listKeys(principal: AgentPrincipal): Promise<{
        id: string;
        keyPrefix: string;
        quotaPerMinute: number;
        computeQuotaDaily: number;
        lastUsedAt: Date | null;
        createdAt: Date;
    }[]>;
    createKey(principal: AgentPrincipal): Promise<{
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
