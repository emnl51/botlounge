import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from "@nestjs/common";
import { executionResultSchema } from "@agent-forum/contracts";
import { executionRuns, submissions, tasks } from "@agent-forum/database";
import { eq } from "drizzle-orm";
import { Worker } from "bullmq";
import type { Redis } from "ioredis";
import type { AppConfig } from "../config.js";
import { decryptTestCode } from "../crypto-vault.js";
import { CONFIG, DATABASE, REDIS } from "../database.provider.js";
import { LogsGateway } from "./logs.gateway.js";

@Injectable()
export class ExecutionWorker implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(ExecutionWorker.name);
  private worker?: Worker;

  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(DATABASE)
    private readonly database: ReturnType<
      typeof import("@agent-forum/database").createDatabase
    >,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly logs: LogsGateway,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker(
      "sandbox-execution",
      async (job) => {
        const submissionId = String(job.data["submissionId"]);
        const [row] = await this.database.db
          .select({ submission: submissions, task: tasks })
          .from(submissions)
          .innerJoin(tasks, eq(submissions.taskId, tasks.id))
          .where(eq(submissions.id, submissionId))
          .limit(1);
        if (!row) throw new Error(`Submission ${submissionId} not found`);

        const [run] = await this.database.db
          .insert(executionRuns)
          .values({ submissionId, status: "running", startedAt: new Date() })
          .returning();
        if (!run) throw new Error("Execution run insert failed");
        await this.database.db
          .update(submissions)
          .set({ status: "running", updatedAt: new Date() })
          .where(eq(submissions.id, submissionId));
        this.logs.emitRun(run.id, { type: "status", data: "running" });

        const response = await fetch(
          `${this.config.SANDBOX_RUNNER_URL}/v1/executions`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${this.config.SANDBOX_SERVICE_TOKEN}`,
            },
            body: JSON.stringify({
              runId: run.id,
              runtime: row.task.runtime,
              source: row.submission.sourceCode,
              testSource: decryptTestCode(
                row.task.testCodeEncrypted,
                this.config.TEST_CODE_ENCRYPTION_KEY,
              ),
              limits: {
                timeoutMs: row.task.timeoutMs,
                memoryMb: row.task.memoryMb,
                cpuMillis: row.task.cpuMillis,
                pids: 64,
                outputBytes: 65_536,
              },
            }),
            signal: AbortSignal.timeout(row.task.timeoutMs + 5_000),
          },
        );
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
      },
      { connection: this.redis, concurrency: 8, lockDuration: 60_000 },
    );
    this.worker.on("failed", (job, error) =>
      this.logger.error(
        `Execution job ${job?.id ?? "unknown"} failed: ${error.message}`,
      ),
    );
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
  }
}
