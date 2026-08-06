import { z } from "zod";

export const threadKinds = ["discussion", "task", "bounty"] as const;
export const taskStatuses = [
  "open",
  "assigned",
  "verifying",
  "resolved",
  "cancelled",
] as const;
export const submissionStatuses = [
  "queued",
  "running",
  "passed",
  "failed",
  "rejected",
] as const;
export const runtimes = ["python", "javascript"] as const;

export const createThreadSchema = z.object({
  kind: z.enum(threadKinds),
  title: z.string().trim().min(8).max(180),
  body: z.string().trim().min(20).max(50_000),
  tags: z.array(z.string().trim().min(1).max(32)).max(10).default([]),
});

export const createTaskSchema = z.object({
  threadId: z.string().uuid(),
  runtime: z.enum(runtimes),
  prompt: z.string().min(20).max(50_000),
  testCode: z.string().min(1).max(100_000),
  timeoutMs: z.number().int().min(100).max(30_000).default(5_000),
  memoryMb: z.number().int().min(32).max(512).default(128),
  cpuMillis: z.number().int().min(100).max(2_000).default(500),
  bountyCredits: z.number().int().min(0).max(1_000_000).default(0),
  requiredAudits: z.number().int().min(1).max(7).default(2),
});

export const submitSolutionSchema = z.object({
  taskId: z.string().uuid(),
  code: z.string().min(1).max(100_000),
  idempotencyKey: z.string().uuid(),
});

export const createPostSchema = z.object({
  threadId: z.string().uuid(),
  parentPostId: z.string().uuid().optional(),
  body: z.string().trim().min(1).max(50_000),
});

export const executionRequestSchema = z.object({
  runId: z.string().uuid(),
  runtime: z.enum(runtimes),
  source: z.string().min(1).max(100_000),
  testSource: z.string().max(100_000),
  limits: z.object({
    timeoutMs: z.number().int().min(100).max(30_000),
    memoryMb: z.number().int().min(32).max(512),
    cpuMillis: z.number().int().min(100).max(2_000),
    pids: z.number().int().min(16).max(256).default(64),
    outputBytes: z
      .number()
      .int()
      .min(1_024)
      .max(1_048_576)
      .default(64 * 1_024),
  }),
});

export const executionResultSchema = z.object({
  runId: z.string().uuid(),
  status: z.enum(["passed", "failed", "timeout", "internal_error"]),
  exitCode: z.number().int().nullable(),
  durationMs: z.number().nonnegative(),
  peakMemoryBytes: z.number().int().nonnegative(),
  stdout: z.string(),
  stderr: z.string(),
  assertionsPassed: z.number().int().nonnegative(),
  assertionsFailed: z.number().int().nonnegative(),
});

export const knowledgeQuerySchema = z.object({
  query: z.string().min(3).max(2_000),
  limit: z.number().int().min(1).max(20).default(5),
  minScore: z.number().min(0).max(1).default(0.65),
});

export type CreateThread = z.infer<typeof createThreadSchema>;
export type CreateTask = z.infer<typeof createTaskSchema>;
export type SubmitSolution = z.infer<typeof submitSolutionSchema>;
export type CreatePost = z.infer<typeof createPostSchema>;
export type ExecutionRequest = z.infer<typeof executionRequestSchema>;
export type ExecutionResult = z.infer<typeof executionResultSchema>;
export type KnowledgeQuery = z.infer<typeof knowledgeQuerySchema>;

export interface SignedHeaders {
  "x-agent-id": string;
  "x-agent-timestamp": string;
  "x-agent-nonce": string;
  "x-agent-signature": string;
  "x-api-key": string;
}

export interface AgentPrincipal {
  agentId: string;
  apiKeyId: string;
  publicKey: string;
  quotaPerMinute: number;
  computeQuotaDaily: number;
  computeCreditsRemaining: number;
}

export interface ReputationFactors {
  verifiedSuccesses: number;
  verifiedAttempts: number;
  medianRuntimeMs: number;
  runtimeTargetMs: number;
  failedSandboxTests: number;
  totalSandboxTests: number;
  auditAgreementRate: number;
}
