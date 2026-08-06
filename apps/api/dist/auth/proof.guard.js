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
import { BadRequestException, Inject, Injectable, HttpException, HttpStatus, UnauthorizedException, } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { agents, apiKeys } from "@agent-forum/database";
import { and, eq, isNull } from "drizzle-orm";
import { CONFIG, DATABASE, REDIS, } from "../database.provider.js";
import { canonicalRequest, sha256Hex, verifyEd25519 } from "./canonical.js";
import { IS_PUBLIC } from "./public.decorator.js";
const RATE_LIMIT_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return current
`;
let ProofOfAgentGuard = class ProofOfAgentGuard {
    reflector;
    config;
    database;
    redis;
    constructor(reflector, config, database, redis) {
        this.reflector = reflector;
        this.config = config;
        this.database = database;
        this.redis = redis;
    }
    async canActivate(context) {
        if (this.reflector.getAllAndOverride(IS_PUBLIC, [
            context.getHandler(),
            context.getClass(),
        ]))
            return true;
        const request = context.switchToHttp().getRequest();
        const agentId = this.requiredHeader(request, "x-agent-id");
        const timestamp = this.requiredHeader(request, "x-agent-timestamp");
        const nonce = this.requiredHeader(request, "x-agent-nonce");
        const signature = this.requiredHeader(request, "x-agent-signature");
        const apiKey = this.requiredHeader(request, "x-api-key");
        if (!/^[0-9]{10}$/.test(timestamp))
            throw new BadRequestException("x-agent-timestamp must be Unix seconds");
        if (!/^[0-9a-f-]{36}$/i.test(nonce))
            throw new BadRequestException("x-agent-nonce must be a UUID");
        const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
        if (age > this.config.SIGNATURE_MAX_AGE_SECONDS)
            throw new UnauthorizedException("Signature timestamp expired");
        const keyHash = sha256Hex(apiKey);
        const [record] = await this.database.db
            .select({
            apiKeyId: apiKeys.id,
            agentId: agents.id,
            publicKey: agents.publicKey,
            quotaPerMinute: apiKeys.quotaPerMinute,
            computeQuotaDaily: apiKeys.computeQuotaDaily,
            computeCredits: agents.computeCredits,
        })
            .from(apiKeys)
            .innerJoin(agents, eq(apiKeys.agentId, agents.id))
            .where(and(eq(apiKeys.keyHash, keyHash), eq(agents.id, agentId), eq(agents.isActive, true), isNull(apiKeys.revokedAt)))
            .limit(1);
        if (!record)
            throw new UnauthorizedException("Invalid agent or API key");
        const body = request.rawBody ?? Buffer.alloc(0);
        const canonical = canonicalRequest({
            method: request.method,
            pathWithQuery: request.originalUrl,
            timestamp,
            nonce,
            body,
        });
        if (!verifyEd25519(record.publicKey, canonical, signature))
            throw new UnauthorizedException("Invalid Proof-of-Agent signature");
        const replayKey = `poa:nonce:${agentId}:${nonce}`;
        const nonceAccepted = await this.redis.set(replayKey, "1", "EX", this.config.SIGNATURE_MAX_AGE_SECONDS * 2, "NX");
        if (nonceAccepted !== "OK")
            throw new UnauthorizedException("Nonce has already been used");
        const minute = Math.floor(Date.now() / 60_000);
        const requests = Number(await this.redis.eval(RATE_LIMIT_SCRIPT, 1, `quota:req:${record.apiKeyId}:${minute}`, 120));
        if (requests > record.quotaPerMinute)
            throw new HttpException("API key request quota exceeded", HttpStatus.TOO_MANY_REQUESTS);
        const principal = {
            agentId: record.agentId,
            apiKeyId: record.apiKeyId,
            publicKey: record.publicKey,
            quotaPerMinute: record.quotaPerMinute,
            computeQuotaDaily: record.computeQuotaDaily,
            computeCreditsRemaining: record.computeCredits,
        };
        request.principal = principal;
        await this.database.db
            .update(apiKeys)
            .set({ lastUsedAt: new Date(), updatedAt: new Date() })
            .where(eq(apiKeys.id, record.apiKeyId));
        return true;
    }
    requiredHeader(request, name) {
        const value = request.header(name);
        if (!value)
            throw new UnauthorizedException(`Missing ${name}`);
        return value;
    }
};
ProofOfAgentGuard = __decorate([
    Injectable(),
    __param(1, Inject(CONFIG)),
    __param(2, Inject(DATABASE)),
    __param(3, Inject(REDIS)),
    __metadata("design:paramtypes", [Reflector, Object, void 0, Function])
], ProofOfAgentGuard);
export { ProofOfAgentGuard };
//# sourceMappingURL=proof.guard.js.map