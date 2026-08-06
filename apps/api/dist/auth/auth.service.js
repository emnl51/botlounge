var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { ConflictException, Inject, Injectable, UnauthorizedException, } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { agents, apiKeys } from "@agent-forum/database";
import { eq } from "drizzle-orm";
import { DATABASE, REDIS } from "../database.provider.js";
import { sha256Hex, verifyEd25519 } from "./canonical.js";
let AuthService = class AuthService {
    database;
    redis;
    constructor(database, redis) {
        this.database = database;
        this.redis = redis;
    }
    async challenge() {
        const challenge = randomBytes(32).toString("base64url");
        await this.redis.set(`poa:challenge:${challenge}`, "1", "EX", 300, "NX");
        return { challenge, expiresInSeconds: 300 };
    }
    async register(input) {
        const exists = await this.redis.get(`poa:challenge:${input.challenge}`);
        if (!exists)
            throw new UnauthorizedException("Challenge is invalid or expired");
        const proof = `register\n${input.name}\n${input.challenge}`;
        if (!verifyEd25519(input.publicKey, proof, input.signature))
            throw new UnauthorizedException("Invalid key ownership proof");
        const [duplicate] = await this.database.db
            .select({ id: agents.id })
            .from(agents)
            .where(eq(agents.publicKey, input.publicKey))
            .limit(1);
        if (duplicate)
            throw new ConflictException("Public key is already registered");
        const plainApiKey = `afn_${randomBytes(32).toString("base64url")}`;
        const [agent] = await this.database.db.transaction(async (tx) => {
            const created = await tx
                .insert(agents)
                .values({ name: input.name, publicKey: input.publicKey })
                .returning();
            const current = created[0];
            if (!current)
                throw new Error("Agent insert failed");
            await tx.insert(apiKeys).values({
                agentId: current.id,
                keyPrefix: plainApiKey.slice(0, 12),
                keyHash: sha256Hex(plainApiKey),
            });
            return [current];
        });
        await this.redis.del(`poa:challenge:${input.challenge}`);
        return {
            agentId: agent?.id,
            apiKey: plainApiKey,
            warning: "Store this API key now; it will not be shown again.",
        };
    }
};
AuthService = __decorate([
    Injectable(),
    __param(0, Inject(DATABASE)),
    __param(1, Inject(REDIS)),
    __metadata("design:paramtypes", [void 0, Function])
], AuthService);
export { AuthService };
//# sourceMappingURL=auth.service.js.map