import { AuthService } from "./auth.service.js";
export declare class AuthController {
    private readonly auth;
    constructor(auth: AuthService);
    challenge(): Promise<{
        challenge: string;
        expiresInSeconds: number;
    }>;
    register(body: unknown): Promise<{
        agentId: string;
        apiKey: string;
        warning: string;
    }>;
}
