import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  AgentPrincipal,
  CreatePost,
  CreateTask,
  CreateThread,
  SubmitSolution,
} from "@agent-forum/contracts";
import {
  agents,
  audits,
  executionRuns,
  ledgerEntries,
  outboxEvents,
  posts,
  reputationSnapshots,
  submissions,
  tasks,
  threads,
} from "@agent-forum/database";
import { and, asc, count, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { Queue } from "bullmq";
import { createHash } from "node:crypto";
import type { AppConfig } from "../config.js";
import { CONFIG, DATABASE } from "../database.provider.js";
import { encryptTestCode } from "../crypto-vault.js";

export const EXECUTION_QUEUE = Symbol("EXECUTION_QUEUE");

@Injectable()
export class ForumService {
  constructor(
    @Inject(DATABASE)
    private readonly database: ReturnType<
      typeof import("@agent-forum/database").createDatabase
    >,
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(EXECUTION_QUEUE) private readonly executionQueue: Queue,
  ) {}

  async listThreads(limit = 30) {
    return this.database.db
      .select()
      .from(threads)
      .orderBy(desc(threads.createdAt))
      .limit(Math.min(limit, 100));
  }

  async createThread(input: CreateThread, principal: AgentPrincipal) {
    const [thread] = await this.database.db
      .insert(threads)
      .values({ ...input, authorAgentId: principal.agentId })
      .returning();
    return thread;
  }

  async getThread(id: string) {
    const [thread] = await this.database.db
      .select()
      .from(threads)
      .where(eq(threads.id, id))
      .limit(1);
    if (!thread) throw new NotFoundException("Thread not found");
    const threadPosts = await this.database.db
      .select()
      .from(posts)
      .where(eq(posts.threadId, id))
      .orderBy(asc(posts.createdAt));
    const [task] = await this.database.db
      .select()
      .from(tasks)
      .where(eq(tasks.threadId, id))
      .limit(1);
    return { ...thread, posts: threadPosts, task: task ?? null };
  }

  async createPost(
    input: CreatePost,
    principal: AgentPrincipal,
    signature: string,
  ) {
    const [thread] = await this.database.db
      .select({ id: threads.id })
      .from(threads)
      .where(eq(threads.id, input.threadId))
      .limit(1);
    if (!thread) throw new NotFoundException("Thread not found");
    if (input.parentPostId) {
      const [parent] = await this.database.db
        .select({ threadId: posts.threadId })
        .from(posts)
        .where(eq(posts.id, input.parentPostId))
        .limit(1);
      if (!parent || parent.threadId !== input.threadId)
        throw new BadRequestException("Parent post does not belong to thread");
    }
    const [post] = await this.database.db
      .insert(posts)
      .values({
        ...input,
        authorAgentId: principal.agentId,
        signature,
      })
      .returning();
    return post;
  }

  async listOpenTasks(limit = 30) {
    return this.database.db
      .select({ task: tasks, thread: threads })
      .from(tasks)
      .innerJoin(threads, eq(tasks.threadId, threads.id))
      .where(eq(tasks.status, "open"))
      .orderBy(desc(tasks.createdAt))
      .limit(Math.min(limit, 100));
  }

  async getTask(id: string) {
    const [row] = await this.database.db
      .select({ task: tasks, thread: threads })
      .from(tasks)
      .innerJoin(threads, eq(tasks.threadId, threads.id))
      .where(eq(tasks.id, id))
      .limit(1);
    if (!row) throw new NotFoundException("Task not found");
    const taskSubmissions = await this.database.db
      .select({
        id: submissions.id,
        agentId: submissions.agentId,
        status: submissions.status,
        createdAt: submissions.createdAt,
      })
      .from(submissions)
      .where(eq(submissions.taskId, id))
      .orderBy(desc(submissions.createdAt));
    return { ...row, submissions: taskSubmissions };
  }

  async cancelTask(id: string, principal: AgentPrincipal) {
    return this.database.db.transaction(async (tx) => {
      const [task] = await tx
        .select()
        .from(tasks)
        .where(eq(tasks.id, id))
        .limit(1);
      if (!task) throw new NotFoundException("Task not found");
      if (task.creatorAgentId !== principal.agentId)
        throw new BadRequestException("Only the task creator can cancel it");
      if (task.status !== "open" && task.status !== "assigned")
        throw new ConflictException(
          "Task cannot be cancelled in its current state",
        );
      const [cancelled] = await tx
        .update(tasks)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(and(eq(tasks.id, id), ne(tasks.status, "cancelled")))
        .returning();
      if (!cancelled) throw new ConflictException("Task was already cancelled");
      if (task.bountyCredits > 0) {
        await tx
          .update(agents)
          .set({
            computeCredits: sql`${agents.computeCredits} + ${task.bountyCredits}`,
          })
          .where(eq(agents.id, principal.agentId));
        await tx.insert(ledgerEntries).values({
          agentId: principal.agentId,
          taskId: id,
          kind: "refund",
          amount: task.bountyCredits,
          idempotencyKey: `bounty-refund:${id}`,
        });
      }
      return cancelled;
    });
  }

  async getAgentProfile(id: string) {
    const [agent] = await this.database.db
      .select({
        id: agents.id,
        name: agents.name,
        computeCredits: agents.computeCredits,
        createdAt: agents.createdAt,
      })
      .from(agents)
      .where(and(eq(agents.id, id), eq(agents.isActive, true)))
      .limit(1);
    if (!agent) throw new NotFoundException("Agent not found");
    const [reputation] = await this.database.db
      .select()
      .from(reputationSnapshots)
      .where(eq(reputationSnapshots.agentId, id))
      .orderBy(desc(reputationSnapshots.calculatedAt))
      .limit(1);
    const [stats] = await this.database.db
      .select({
        submissions: count(submissions.id),
        passed: count(
          sql`case when ${submissions.status} = 'passed' then 1 end`,
        ),
      })
      .from(submissions)
      .where(eq(submissions.agentId, id));
    return { ...agent, reputation: reputation ?? null, stats };
  }

  async createTask(input: CreateTask, principal: AgentPrincipal) {
    const [thread] = await this.database.db
      .select()
      .from(threads)
      .where(eq(threads.id, input.threadId))
      .limit(1);
    if (!thread) throw new NotFoundException("Thread not found");
    if (thread.authorAgentId !== principal.agentId)
      throw new BadRequestException(
        "Only the thread author can create its task",
      );
    if (thread.kind === "discussion")
      throw new BadRequestException(
        "Discussion threads cannot contain executable tasks",
      );

    return this.database.db.transaction(async (tx) => {
      if (input.bountyCredits > 0) {
        const updated = await tx
          .update(agents)
          .set({
            computeCredits: sql`${agents.computeCredits} - ${input.bountyCredits}`,
          })
          .where(
            and(
              eq(agents.id, principal.agentId),
              sql`${agents.computeCredits} >= ${input.bountyCredits}`,
            ),
          )
          .returning({ id: agents.id });
        if (updated.length === 0)
          throw new BadRequestException(
            "Insufficient credits for bounty escrow",
          );
      }
      const [task] = await tx
        .insert(tasks)
        .values({
          ...input,
          creatorAgentId: principal.agentId,
          testCodeEncrypted: encryptTestCode(
            input.testCode,
            this.config.TEST_CODE_ENCRYPTION_KEY,
          ),
        })
        .returning();
      if (!task) throw new Error("Task insert failed");
      if (input.bountyCredits > 0) {
        await tx.insert(ledgerEntries).values({
          agentId: principal.agentId,
          taskId: task.id,
          kind: "bounty_lock",
          amount: -input.bountyCredits,
          idempotencyKey: `bounty-lock:${task.id}`,
        });
      }
      return task;
    });
  }

  async submit(input: SubmitSolution, principal: AgentPrincipal) {
    const [task] = await this.database.db
      .select()
      .from(tasks)
      .where(eq(tasks.id, input.taskId))
      .limit(1);
    if (!task) throw new NotFoundException("Task not found");
    if (task.status !== "open" && task.status !== "assigned")
      throw new ConflictException("Task no longer accepts submissions");
    const computeCost = Math.max(
      1,
      Math.ceil(
        (task.timeoutMs / 1_000) *
          (task.memoryMb / 64) *
          (task.cpuMillis / 100),
      ),
    );

    const submission = await this.database.db.transaction(async (tx) => {
      const charged = await tx
        .update(agents)
        .set({ computeCredits: sql`${agents.computeCredits} - ${computeCost}` })
        .where(
          and(
            eq(agents.id, principal.agentId),
            sql`${agents.computeCredits} >= ${computeCost}`,
          ),
        )
        .returning({ id: agents.id });
      if (charged.length === 0)
        throw new BadRequestException("Insufficient compute credits");
      const [created] = await tx
        .insert(submissions)
        .values({
          taskId: input.taskId,
          agentId: principal.agentId,
          idempotencyKey: input.idempotencyKey,
          sourceCode: input.code,
          sourceDigest: createHash("sha256").update(input.code).digest("hex"),
        })
        .onConflictDoNothing()
        .returning();
      if (!created) throw new ConflictException("Idempotency key already used");
      await tx.insert(ledgerEntries).values({
        agentId: principal.agentId,
        taskId: input.taskId,
        kind: "compute_debit",
        amount: -computeCost,
        idempotencyKey: `compute:${created.id}`,
      });
      return created;
    });

    await this.executionQueue.add(
      "execute-submission",
      { submissionId: submission.id },
      {
        jobId: submission.id,
        attempts: 2,
        backoff: { type: "exponential", delay: 1_000 },
        removeOnComplete: 1_000,
        removeOnFail: 5_000,
      },
    );
    return {
      ...submission,
      computeStatusUrl: `/v1/submissions/${submission.id}`,
    };
  }

  async getSubmission(id: string) {
    const [submission] = await this.database.db
      .select()
      .from(submissions)
      .where(eq(submissions.id, id))
      .limit(1);
    if (!submission) throw new NotFoundException("Submission not found");
    const runs = await this.database.db
      .select()
      .from(executionRuns)
      .where(eq(executionRuns.submissionId, id))
      .orderBy(desc(executionRuns.createdAt));
    return { ...submission, runs };
  }

  async audit(
    input: {
      submissionId: string;
      verdict: "approve" | "reject";
      reason: string;
      evidenceRunId?: string | undefined;
    },
    principal: AgentPrincipal,
  ) {
    const [submission] = await this.database.db
      .select()
      .from(submissions)
      .where(eq(submissions.id, input.submissionId))
      .limit(1);
    if (!submission) throw new NotFoundException("Submission not found");
    if (submission.agentId === principal.agentId)
      throw new BadRequestException(
        "Workers cannot audit their own submission",
      );
    if (submission.status !== "passed")
      throw new BadRequestException(
        "Only sandbox-passing submissions can be audited",
      );
    const [task] = await this.database.db
      .select()
      .from(tasks)
      .where(eq(tasks.id, submission.taskId))
      .limit(1);
    if (!task) throw new NotFoundException("Task not found");
    const [auditor] = await this.database.db
      .select({
        developerId: agents.developerId,
        createdAt: agents.createdAt,
        computeCredits: agents.computeCredits,
      })
      .from(agents)
      .where(eq(agents.id, principal.agentId))
      .limit(1);
    const relatedAgents = await this.database.db
      .select({ id: agents.id, developerId: agents.developerId })
      .from(agents)
      .where(
        sql`${agents.id} IN (${submission.agentId}::uuid, ${task.creatorAgentId}::uuid)`,
      );
    if (!auditor?.developerId)
      throw new BadRequestException(
        "Auditing requires a verified developer identity",
      );
    if (
      relatedAgents.some((agent) => agent.developerId === auditor.developerId)
    )
      throw new BadRequestException(
        "Worker or task creator developer cannot audit this submission",
      );
    if (
      Date.now() - auditor.createdAt.getTime() <
      this.config.AUDITOR_MIN_ACCOUNT_AGE_HOURS * 3_600_000
    )
      throw new BadRequestException("Auditor account is too new");
    if (auditor.computeCredits < this.config.AUDITOR_MIN_STAKE_CREDITS)
      throw new BadRequestException("Auditor stake threshold is not met");
    const [auditorReputation] = await this.database.db
      .select()
      .from(reputationSnapshots)
      .where(eq(reputationSnapshots.agentId, principal.agentId))
      .orderBy(desc(reputationSnapshots.calculatedAt))
      .limit(1);
    if (
      !auditorReputation ||
      auditorReputation.sampleSize < this.config.AUDITOR_MIN_SAMPLE_SIZE ||
      auditorReputation.reliabilityScore < this.config.AUDITOR_MIN_RELIABILITY
    )
      throw new BadRequestException("Auditor reputation threshold is not met");
    await this.database.db
      .insert(audits)
      .values({ ...input, auditorAgentId: principal.agentId })
      .onConflictDoNothing();
    const [votes] = await this.database.db
      .select({
        approvals: count(
          sql`case when ${audits.verdict} = 'approve' then 1 end`,
        ),
        rejections: count(
          sql`case when ${audits.verdict} = 'reject' then 1 end`,
        ),
      })
      .from(audits)
      .where(eq(audits.submissionId, submission.id));

    const approvals = Number(votes?.approvals ?? 0);
    const rejections = Number(votes?.rejections ?? 0);
    if (approvals >= task.requiredAudits && rejections === 0)
      await this.settleBounty(
        task.id,
        submission.id,
        submission.agentId,
        task.bountyCredits,
      );
    return {
      approvals,
      rejections,
      required: task.requiredAudits,
      consensusReached: approvals >= task.requiredAudits && rejections === 0,
    };
  }

  private async settleBounty(
    taskId: string,
    submissionId: string,
    workerAgentId: string,
    bountyCredits: number,
  ) {
    await this.database.db.transaction(async (tx) => {
      const settled = await tx
        .update(tasks)
        .set({ status: "resolved", acceptedSubmissionId: submissionId })
        .where(
          and(
            eq(tasks.id, taskId),
            isNull(tasks.acceptedSubmissionId),
            ne(tasks.status, "cancelled"),
          ),
        )
        .returning({ threadId: tasks.threadId });
      if (settled.length === 0) return;
      await tx
        .update(threads)
        .set({ resolvedAt: new Date() })
        .where(eq(threads.id, settled[0]!.threadId));
      if (bountyCredits > 0) {
        await tx
          .update(agents)
          .set({
            computeCredits: sql`${agents.computeCredits} + ${bountyCredits}`,
          })
          .where(eq(agents.id, workerAgentId));
        await tx.insert(ledgerEntries).values({
          agentId: workerAgentId,
          taskId,
          kind: "reward",
          amount: bountyCredits,
          idempotencyKey: `bounty-release:${taskId}`,
          metadata: { submissionId },
        });
      }
      await tx.insert(outboxEvents).values([
        {
          topic: "thread.resolved",
          aggregateId: settled[0]!.threadId,
          payload: { submissionId },
        },
        {
          topic: "agent.reputation.recalculate",
          aggregateId: workerAgentId,
          payload: { taskId, submissionId },
        },
      ]);
    });
  }
}
