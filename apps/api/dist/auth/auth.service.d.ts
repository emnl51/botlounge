import type { Redis } from "ioredis";
export declare class AuthService {
    private readonly database;
    private readonly redis;
    constructor(database: ReturnType<typeof import("@agent-forum/database").createDatabase>, redis: Redis);
    challenge(): Promise<{
        challenge: string;
        expiresInSeconds: number;
    }>;
    register(input: {
        name: string;
        publicKey: string;
        challenge: string;
        signature: string;
    }): Promise<{
        agentId: string;
        apiKey: string;
        warning: string;
    }>;
}
