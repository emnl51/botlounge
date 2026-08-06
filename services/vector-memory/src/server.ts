import Fastify from "fastify";
import { QdrantClient } from "@qdrant/js-client-rest";
import { createHash, timingSafeEqual } from "node:crypto";
import { knowledgeQuerySchema } from "@agent-forum/contracts";
import { z } from "zod";
import { chunkResolvedThread } from "./chunking.js";
import {
  DeterministicDevelopmentEmbedder,
  OpenAICompatibleEmbedder,
  type Embedder,
} from "./embeddings.js";

const env = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().default(4200),
    INTERNAL_SERVICE_TOKEN: z.string().min(32),
    QDRANT_URL: z.string().url().default("http://qdrant:6333"),
    QDRANT_API_KEY: z.string().optional(),
    QDRANT_COLLECTION: z.string().default("resolved_threads_v1"),
    EMBEDDING_BASE_URL: z.string().url().optional(),
    EMBEDDING_API_KEY: z.string().optional(),
    EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
    EMBEDDING_DIMENSIONS: z.coerce.number().int().default(1536),
  })
  .parse(process.env);

if (
  env.NODE_ENV === "production" &&
  (!env.EMBEDDING_BASE_URL || !env.EMBEDDING_API_KEY)
) {
  throw new Error(
    "Production requires EMBEDDING_BASE_URL and EMBEDDING_API_KEY",
  );
}
const embedder: Embedder =
  env.EMBEDDING_BASE_URL && env.EMBEDDING_API_KEY
    ? new OpenAICompatibleEmbedder(
        env.EMBEDDING_BASE_URL,
        env.EMBEDDING_API_KEY,
        env.EMBEDDING_MODEL,
        env.EMBEDDING_DIMENSIONS,
      )
    : new DeterministicDevelopmentEmbedder();
const qdrant = new QdrantClient(
  env.QDRANT_API_KEY
    ? { url: env.QDRANT_URL, apiKey: env.QDRANT_API_KEY }
    : { url: env.QDRANT_URL },
);
const app = Fastify({ logger: true, bodyLimit: 2 * 1024 * 1024 });

function stablePointId(threadId: string, contentHash: string): string {
  const bytes = createHash("sha256")
    .update(`${threadId}:${contentHash}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

app.addHook("onRequest", async (request, reply) => {
  if (request.url === "/healthz") return;
  const expected = Buffer.from(`Bearer ${env.INTERNAL_SERVICE_TOKEN}`);
  const actual = Buffer.from(request.headers.authorization ?? "");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    await reply.code(401).send({ error: "unauthorized" });
});

async function ensureCollection(): Promise<void> {
  const collections = await qdrant.getCollections();
  if (
    !collections.collections.some((item) => item.name === env.QDRANT_COLLECTION)
  ) {
    await qdrant.createCollection(env.QDRANT_COLLECTION, {
      vectors: { size: embedder.dimensions, distance: "Cosine" },
    });
  }
}

app.get("/healthz", async () => {
  await qdrant.getCollections();
  return {
    status: "ok",
    service: "vector-memory",
    dimensions: embedder.dimensions,
  };
});

const indexSchema = z.object({
  threadId: z.string().uuid(),
  title: z.string().min(1).max(180),
  content: z.string().min(20).max(1_000_000),
  tags: z.array(z.string()).max(10).default([]),
  resolvedAt: z.string().datetime(),
});

app.post("/v1/index", async (request, reply) => {
  const parsed = indexSchema.safeParse(request.body);
  if (!parsed.success)
    return reply
      .code(400)
      .send({ error: "invalid_request", details: parsed.error.flatten() });
  const chunks = chunkResolvedThread(
    `${parsed.data.title}\n\n${parsed.data.content}`,
  );
  const vectors = await embedder.embed(chunks.map((chunk) => chunk.content));
  await ensureCollection();
  await qdrant.upsert(env.QDRANT_COLLECTION, {
    wait: true,
    points: chunks.map((chunk, index) => ({
      id: stablePointId(parsed.data.threadId, chunk.contentHash),
      vector: vectors[index]!,
      payload: {
        threadId: parsed.data.threadId,
        title: parsed.data.title,
        tags: parsed.data.tags,
        resolvedAt: parsed.data.resolvedAt,
        ...chunk,
      },
    })),
  });
  return {
    indexed: chunks.length,
    hashes: chunks.map((chunk) => chunk.contentHash),
  };
});

app.post("/v1/query", async (request, reply) => {
  const parsed = knowledgeQuerySchema.safeParse(request.body);
  if (!parsed.success)
    return reply
      .code(400)
      .send({ error: "invalid_request", details: parsed.error.flatten() });
  await ensureCollection();
  const [vector] = await embedder.embed([parsed.data.query]);
  const result = await qdrant.query(env.QDRANT_COLLECTION, {
    query: vector!,
    limit: parsed.data.limit,
    score_threshold: parsed.data.minScore,
    with_payload: true,
  });
  return {
    matches: result.points.map((point) => ({
      score: point.score,
      ...point.payload,
    })),
  };
});

await app.listen({ host: "0.0.0.0", port: env.PORT });
