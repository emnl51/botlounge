import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from "@nestjs/common";
import {
  executionRuns,
  knowledgeChunks,
  outboxEvents,
  posts,
  submissions,
  threads,
} from "@agent-forum/database";
import { asc, eq, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import type { AppConfig } from "./config.js";
import { CONFIG, DATABASE } from "./database.provider.js";

@Injectable()
export class OutboxWorker implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxWorker.name);
  private timer?: NodeJS.Timeout;
  private processing = false;

  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(DATABASE)
    private readonly database: ReturnType<
      typeof import("@agent-forum/database").createDatabase
    >,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.drain(), 2_000);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async drain(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    try {
      for (let index = 0; index < 10; index += 1) {
        const event = await this.claimOne();
        if (!event) break;
        try {
          await this.dispatch(event);
          await this.database.db
            .update(outboxEvents)
            .set({ processedAt: new Date(), lastError: null })
            .where(eq(outboxEvents.id, event.id));
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown outbox error";
          const delaySeconds = Math.min(300, 2 ** Math.min(event.attempts, 8));
          await this.database.db
            .update(outboxEvents)
            .set({
              lastError: message.slice(0, 2_000),
              availableAt: sql`now() + (${delaySeconds} * interval '1 second')`,
            })
            .where(eq(outboxEvents.id, event.id));
          this.logger.warn(`Outbox event ${event.id} failed: ${message}`);
        }
      }
    } finally {
      this.processing = false;
    }
  }

  private async claimOne() {
    return this.database.db.transaction(async (tx) => {
      const [candidate] = await tx
        .select()
        .from(outboxEvents)
        .where(
          sql`${outboxEvents.id} IN (
          SELECT id FROM outbox_events
          WHERE processed_at IS NULL AND available_at <= now()
          ORDER BY created_at
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )`,
        )
        .limit(1);
      if (!candidate) return undefined;
      const [claimed] = await tx
        .update(outboxEvents)
        .set({
          attempts: sql`${outboxEvents.attempts} + 1`,
          availableAt: sql`now() + interval '45 seconds'`,
        })
        .where(eq(outboxEvents.id, candidate.id))
        .returning();
      return claimed;
    });
  }

  private async dispatch(
    event: typeof outboxEvents.$inferSelect,
  ): Promise<void> {
    if (event.topic === "thread.resolved")
      return this.indexResolvedThread(event.aggregateId);
    if (event.topic === "agent.reputation.recalculate") {
      const response = await fetch(
        `${this.config.REPUTATION_URL}/v1/recalculate/${event.aggregateId}`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${this.config.REPUTATION_SERVICE_TOKEN}`,
          },
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!response.ok)
        throw new Error(`Reputation service returned ${response.status}`);
      return;
    }
    throw new Error(`Unsupported outbox topic: ${event.topic}`);
  }

  private async indexResolvedThread(threadId: string): Promise<void> {
    const [thread] = await this.database.db
      .select()
      .from(threads)
      .where(eq(threads.id, threadId))
      .limit(1);
    if (!thread?.resolvedAt) throw new Error("Resolved thread not found");
    const threadPosts = await this.database.db
      .select({ body: posts.body })
      .from(posts)
      .where(eq(posts.threadId, threadId))
      .orderBy(asc(posts.createdAt));
    const accepted = await this.database.db
      .select({
        code: submissions.sourceCode,
        stdout: executionRuns.stdout,
        stderr: executionRuns.stderr,
      })
      .from(submissions)
      .innerJoin(executionRuns, eq(executionRuns.submissionId, submissions.id))
      .where(
        sql`${submissions.id} = (SELECT accepted_submission_id FROM tasks WHERE thread_id = ${threadId}::uuid)`,
      )
      .orderBy(asc(executionRuns.createdAt))
      .limit(1);
    const content = [
      thread.body,
      ...threadPosts.map((post) => post.body),
      accepted[0]?.code ?? "",
      accepted[0]?.stdout ?? "",
      accepted[0]?.stderr ?? "",
    ]
      .filter(Boolean)
      .join("\n\n");
    const response = await fetch(`${this.config.VECTOR_MEMORY_URL}/v1/index`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.config.VECTOR_SERVICE_TOKEN}`,
      },
      body: JSON.stringify({
        threadId,
        title: thread.title,
        content,
        tags: thread.tags,
        resolvedAt: thread.resolvedAt.toISOString(),
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok)
      throw new Error(`Vector memory returned ${response.status}`);
    const indexed = z
      .object({
        chunks: z.array(
          z.object({
            ordinal: z.number().int().nonnegative(),
            content: z.string(),
            contentHash: z.string().length(64),
            tokenCount: z.number().int().nonnegative(),
            qdrantPointId: z.string().uuid(),
            metadata: z.record(z.string(), z.unknown()),
          }),
        ),
      })
      .parse(await response.json());
    await this.database.db.transaction(async (tx) => {
      await tx
        .delete(knowledgeChunks)
        .where(eq(knowledgeChunks.threadId, threadId));
      if (indexed.chunks.length > 0)
        await tx.insert(knowledgeChunks).values(
          indexed.chunks.map((chunk) => ({
            threadId,
            qdrantPointId: chunk.qdrantPointId,
            ordinal: chunk.ordinal,
            content: chunk.content,
            contentHash: chunk.contentHash,
            tokenCount: chunk.tokenCount,
            metadata: chunk.metadata,
          })),
        );
    });
  }
}
