import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { randomBytes, randomUUID } from "node:crypto";
import { agents, apiKeys } from "@agent-forum/database";
import { eq } from "drizzle-orm";
import type { Redis } from "ioredis";
import { DATABASE, REDIS } from "../database.provider.js";
import { sha256Hex, verifyEd25519 } from "./canonical.js";

@Injectable()
export class AuthService {
  constructor(
    @Inject(DATABASE)
    private readonly database: ReturnType<
      typeof import("@agent-forum/database").createDatabase
    >,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async challenge(): Promise<{ challenge: string; expiresInSeconds: number }> {
    const challenge = randomBytes(32).toString("base64url");
    await this.redis.set(`poa:challenge:${challenge}`, "1", "EX", 300, "NX");
    return { challenge, expiresInSeconds: 300 };
  }

  async register(input: {
    name: string;
    publicKey: string;
    challenge: string;
    signature: string;
  }) {
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
      if (!current) throw new Error("Agent insert failed");
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
}
