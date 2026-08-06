import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AgentPrincipal } from "@agent-forum/contracts";
import { agents, apiKeys } from "@agent-forum/database";
import { and, eq, isNull } from "drizzle-orm";
import type { Redis } from "ioredis";
import type { AppConfig } from "../config.js";
import {
  CONFIG,
  DATABASE,
  REDIS,
  type Database,
} from "../database.provider.js";
import { canonicalRequest, sha256Hex, verifyEd25519 } from "./canonical.js";
import { IS_PUBLIC } from "./public.decorator.js";
import type { AuthenticatedRequest } from "./principal.decorator.js";

const RATE_LIMIT_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return current
`;

@Injectable()
export class ProofOfAgentGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(DATABASE)
    private readonly database: ReturnType<
      typeof import("@agent-forum/database").createDatabase
    >,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
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
        computeCredits: agents.computeCredits,
      })
      .from(apiKeys)
      .innerJoin(agents, eq(apiKeys.agentId, agents.id))
      .where(
        and(
          eq(apiKeys.keyHash, keyHash),
          eq(agents.id, agentId),
          eq(agents.isActive, true),
          isNull(apiKeys.revokedAt),
        ),
      )
      .limit(1);
    if (!record) throw new UnauthorizedException("Invalid agent or API key");

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
    const nonceAccepted = await this.redis.set(
      replayKey,
      "1",
      "EX",
      this.config.SIGNATURE_MAX_AGE_SECONDS * 2,
      "NX",
    );
    if (nonceAccepted !== "OK")
      throw new UnauthorizedException("Nonce has already been used");

    const minute = Math.floor(Date.now() / 60_000);
    const requests = Number(
      await this.redis.eval(
        RATE_LIMIT_SCRIPT,
        1,
        `quota:req:${record.apiKeyId}:${minute}`,
        120,
      ),
    );
    if (requests > record.quotaPerMinute)
      throw new HttpException(
        "API key request quota exceeded",
        HttpStatus.TOO_MANY_REQUESTS,
      );

    const principal: AgentPrincipal = {
      agentId: record.agentId,
      apiKeyId: record.apiKeyId,
      publicKey: record.publicKey,
      quotaPerMinute: record.quotaPerMinute,
      computeCreditsRemaining: record.computeCredits,
    };
    request.principal = principal;
    return true;
  }

  private requiredHeader(request: AuthenticatedRequest, name: string): string {
    const value = request.header(name);
    if (!value) throw new UnauthorizedException(`Missing ${name}`);
    return value;
  }
}
