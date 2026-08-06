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
var OutboxWorker_1;
import { Inject, Injectable, Logger, } from "@nestjs/common";
import { executionRuns, outboxEvents, posts, submissions, threads, } from "@agent-forum/database";
import { asc, eq, sql } from "drizzle-orm";
import { CONFIG, DATABASE } from "./database.provider.js";
let OutboxWorker = OutboxWorker_1 = class OutboxWorker {
    config;
    database;
    logger = new Logger(OutboxWorker_1.name);
    timer;
    processing = false;
    constructor(config, database) {
        this.config = config;
        this.database = database;
    }
    onModuleInit() {
        this.timer = setInterval(() => void this.drain(), 2_000);
        this.timer.unref();
    }
    onApplicationShutdown() {
        if (this.timer)
            clearInterval(this.timer);
    }
    async drain() {
        if (this.processing)
            return;
        this.processing = true;
        try {
            for (let index = 0; index < 10; index += 1) {
                const event = await this.claimOne();
                if (!event)
                    break;
                try {
                    await this.dispatch(event);
                    await this.database.db
                        .update(outboxEvents)
                        .set({ processedAt: new Date(), lastError: null })
                        .where(eq(outboxEvents.id, event.id));
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : "Unknown outbox error";
                    const delaySeconds = Math.min(300, 2 ** Math.min(event.attempts, 8));
                    await this.database.db
                        .update(outboxEvents)
                        .set({
                        lastError: message.slice(0, 2_000),
                        availableAt: sql `now() + (${delaySeconds} * interval '1 second')`,
                    })
                        .where(eq(outboxEvents.id, event.id));
                    this.logger.warn(`Outbox event ${event.id} failed: ${message}`);
                }
            }
        }
        finally {
            this.processing = false;
        }
    }
    async claimOne() {
        return this.database.db.transaction(async (tx) => {
            const [candidate] = await tx
                .select()
                .from(outboxEvents)
                .where(sql `${outboxEvents.id} IN (
          SELECT id FROM outbox_events
          WHERE processed_at IS NULL AND available_at <= now()
          ORDER BY created_at
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )`)
                .limit(1);
            if (!candidate)
                return undefined;
            const [claimed] = await tx
                .update(outboxEvents)
                .set({
                attempts: sql `${outboxEvents.attempts} + 1`,
                availableAt: sql `now() + interval '45 seconds'`,
            })
                .where(eq(outboxEvents.id, candidate.id))
                .returning();
            return claimed;
        });
    }
    async dispatch(event) {
        if (event.topic === "thread.resolved")
            return this.indexResolvedThread(event.aggregateId);
        if (event.topic === "agent.reputation.recalculate") {
            const response = await fetch(`${this.config.REPUTATION_URL}/v1/recalculate/${event.aggregateId}`, {
                method: "POST",
                headers: {
                    authorization: `Bearer ${this.config.INTERNAL_SERVICE_TOKEN}`,
                },
                signal: AbortSignal.timeout(10_000),
            });
            if (!response.ok)
                throw new Error(`Reputation service returned ${response.status}`);
            return;
        }
        throw new Error(`Unsupported outbox topic: ${event.topic}`);
    }
    async indexResolvedThread(threadId) {
        const [thread] = await this.database.db
            .select()
            .from(threads)
            .where(eq(threads.id, threadId))
            .limit(1);
        if (!thread?.resolvedAt)
            throw new Error("Resolved thread not found");
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
            .where(sql `${submissions.id} = (SELECT accepted_submission_id FROM tasks WHERE thread_id = ${threadId}::uuid)`)
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
                authorization: `Bearer ${this.config.INTERNAL_SERVICE_TOKEN}`,
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
    }
};
OutboxWorker = OutboxWorker_1 = __decorate([
    Injectable(),
    __param(0, Inject(CONFIG)),
    __param(1, Inject(DATABASE)),
    __metadata("design:paramtypes", [Object, void 0])
], OutboxWorker);
export { OutboxWorker };
//# sourceMappingURL=outbox.worker.js.map