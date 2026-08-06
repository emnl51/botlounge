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
import { ConflictException, HttpException, HttpStatus, Inject, Injectable, UnauthorizedException, } from "@nestjs/common";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { agents, apiKeys } from "@agent-forum/database";
import { and, eq, isNull } from "drizzle-orm";
import { CONFIG, DATABASE, REDIS } from "../database.provider.js";
import { sha256Hex, verifyEd25519 } from "./canonical.js";
let AuthService = class AuthService {
    database;
    redis;
    config;
    constructor(database, redis, config) {
        this.database = database;
        this.redis = redis;
        this.config = config;
    }
    async enforcePublicLimit(kind, ip, limit) {
        const key = `public-rate:${kind}:${ip}:${Math.floor(Date.now() / 60_000)}`;
        const count = await this.redis.incr(key);
        if (count === 1)
            await this.redis.expire(key, 120);
        if (count > limit)
            throw new HttpException("Public endpoint rate limit exceeded", HttpStatus.TOO_MANY_REQUESTS);
    }
    async challenge(ip) {
        await this.enforcePublicLimit("challenge", ip, 10);
        const challenge = randomBytes(32).toString("base64url");
        await this.redis.set(`poa:challenge:${challenge}`, "1", "EX", 300, "NX");
        return { challenge, expiresInSeconds: 300 };
    }
    async register(input, ip) {
        await this.enforcePublicLimit("register", ip, 5);
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
        const developerId = input.developerToken
            ? this.verifyDeveloperToken(input.developerToken)
            : undefined;
        const [agent] = await this.database.db.transaction(async (tx) => {
            const created = await tx
                .insert(agents)
                .values({ name: input.name, publicKey: input.publicKey, developerId })
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
    verifyDeveloperToken(token) {
        const match = /^dev_([0-9a-f-]{36})_([A-Za-z0-9_-]{43})$/i.exec(token);
        if (!match?.[1] || !match[2])
            throw new UnauthorizedException("Invalid developer verification token");
        const expected = createHmac("sha256", this.config.DEVELOPER_TOKEN_SIGNING_SECRET)
            .update(match[1])
            .digest("base64url");
        const actualBuffer = Buffer.from(match[2]);
        const expectedBuffer = Buffer.from(expected);
        if (actualBuffer.length !== expectedBuffer.length ||
            !timingSafeEqual(actualBuffer, expectedBuffer))
            throw new UnauthorizedException("Invalid developer verification token");
        return match[1];
    }
    async listKeys(agentId) {
        return this.database.db
            .select({
            id: apiKeys.id,
            keyPrefix: apiKeys.keyPrefix,
            quotaPerMinute: apiKeys.quotaPerMinute,
            computeQuotaDaily: apiKeys.computeQuotaDaily,
            lastUsedAt: apiKeys.lastUsedAt,
            createdAt: apiKeys.createdAt,
        })
            .from(apiKeys)
            .where(and(eq(apiKeys.agentId, agentId), isNull(apiKeys.revokedAt)));
    }
    async createKey(agentId) {
        const plainApiKey = `afn_${randomBytes(32).toString("base64url")}`;
        const [key] = await this.database.db
            .insert(apiKeys)
            .values({
            agentId,
            keyPrefix: plainApiKey.slice(0, 12),
            keyHash: sha256Hex(plainApiKey),
        })
            .returning({ id: apiKeys.id, keyPrefix: apiKeys.keyPrefix });
        return {
            ...key,
            apiKey: plainApiKey,
            warning: "Store this API key now; it will not be shown again.",
        };
    }
    async revokeKey(id, principal) {
        if (id === principal.apiKeyId)
            throw new ConflictException("Create another key before revoking the active key");
        const [revoked] = await this.database.db
            .update(apiKeys)
            .set({ revokedAt: new Date(), updatedAt: new Date() })
            .where(and(eq(apiKeys.id, id), eq(apiKeys.agentId, principal.agentId), isNull(apiKeys.revokedAt)))
            .returning({ id: apiKeys.id, revokedAt: apiKeys.revokedAt });
        if (!revoked)
            throw new UnauthorizedException("API key not found");
        return revoked;
    }
};
AuthService = __decorate([
    Injectable(),
    __param(0, Inject(DATABASE)),
    __param(1, Inject(REDIS)),
    __param(2, Inject(CONFIG)),
    __metadata("design:paramtypes", [void 0, Function, Object])
], AuthService);
export { AuthService };
//# sourceMappingURL=auth.service.js.map