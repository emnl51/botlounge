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
var ExecutionWorker_1;
import { Inject, Injectable, Logger, } from "@nestjs/common";
import { executionResultSchema } from "@agent-forum/contracts";
import { executionRuns, submissions, tasks } from "@agent-forum/database";
import { eq } from "drizzle-orm";
import { Worker } from "bullmq";
import { decryptTestCode } from "../crypto-vault.js";
import { CONFIG, DATABASE, REDIS } from "../database.provider.js";
import { LogsGateway } from "./logs.gateway.js";
let ExecutionWorker = ExecutionWorker_1 = class ExecutionWorker {
    config;
    database;
    redis;
    logs;
    logger = new Logger(ExecutionWorker_1.name);
    worker;
    constructor(config, database, redis, logs) {
        this.config = config;
        this.database = database;
        this.redis = redis;
        this.logs = logs;
    }
    onModuleInit() {
        this.worker = new Worker("sandbox-execution", async (job) => {
            const submissionId = String(job.data["submissionId"]);
            const [row] = await this.database.db
                .select({ submission: submissions, task: tasks })
                .from(submissions)
                .innerJoin(tasks, eq(submissions.taskId, tasks.id))
                .where(eq(submissions.id, submissionId))
                .limit(1);
            if (!row)
                throw new Error(`Submission ${submissionId} not found`);
            const [run] = await this.database.db
                .insert(executionRuns)
                .values({ submissionId, status: "running", startedAt: new Date() })
                .returning();
            if (!run)
                throw new Error("Execution run insert failed");
            await this.database.db
                .update(submissions)
                .set({ status: "running", updatedAt: new Date() })
                .where(eq(submissions.id, submissionId));
            this.logs.emitRun(run.id, { type: "status", data: "running" });
            const response = await fetch(`${this.config.SANDBOX_RUNNER_URL}/v1/executions`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    authorization: `Bearer ${this.config.SANDBOX_SERVICE_TOKEN}`,
                },
                body: JSON.stringify({
                    runId: run.id,
                    runtime: row.task.runtime,
                    source: row.submission.sourceCode,
                    testSource: decryptTestCode(row.task.testCodeEncrypted, this.config.TEST_CODE_ENCRYPTION_KEY),
                    limits: {
                        timeoutMs: row.task.timeoutMs,
                        memoryMb: row.task.memoryMb,
                        cpuMillis: row.task.cpuMillis,
                        pids: 64,
                        outputBytes: 65_536,
                    },
                }),
                signal: AbortSignal.timeout(row.task.timeoutMs + 5_000),
            });
            if (!response.ok)
                throw new Error(`Sandbox runner returned ${response.status}`);
            const result = executionResultSchema.parse(await response.json());
            const passed = result.status === "passed";
            await this.database.db.transaction(async (tx) => {
                await tx
                    .update(executionRuns)
                    .set({
                    status: result.status,
                    exitCode: result.exitCode,
                    durationMs: Math.ceil(result.durationMs),
                    peakMemoryBytes: result.peakMemoryBytes,
                    stdout: result.stdout,
                    stderr: result.stderr,
                    assertionsPassed: result.assertionsPassed,
                    assertionsFailed: result.assertionsFailed,
                    finishedAt: new Date(),
                    updatedAt: new Date(),
                })
                    .where(eq(executionRuns.id, run.id));
                await tx
                    .update(submissions)
                    .set({
                    status: passed ? "passed" : "failed",
                    updatedAt: new Date(),
                })
                    .where(eq(submissions.id, submissionId));
            });
            if (result.stdout)
                this.logs.emitRun(run.id, { type: "stdout", data: result.stdout });
            if (result.stderr)
                this.logs.emitRun(run.id, { type: "stderr", data: result.stderr });
            this.logs.emitRun(run.id, {
                type: "metrics",
                data: {
                    durationMs: result.durationMs,
                    peakMemoryBytes: result.peakMemoryBytes,
                },
            });
            this.logs.emitRun(run.id, { type: "status", data: result.status });
            return result;
        }, { connection: this.redis, concurrency: 8, lockDuration: 60_000 });
        this.worker.on("failed", (job, error) => this.logger.error(`Execution job ${job?.id ?? "unknown"} failed: ${error.message}`));
    }
    async onApplicationShutdown() {
        await this.worker?.close();
    }
};
ExecutionWorker = ExecutionWorker_1 = __decorate([
    Injectable(),
    __param(0, Inject(CONFIG)),
    __param(1, Inject(DATABASE)),
    __param(2, Inject(REDIS)),
    __metadata("design:paramtypes", [Object, void 0, Function, LogsGateway])
], ExecutionWorker);
export { ExecutionWorker };
//# sourceMappingURL=execution.worker.js.map