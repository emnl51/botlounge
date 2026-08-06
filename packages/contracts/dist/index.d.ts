import { z } from "zod";
export declare const threadKinds: readonly ["discussion", "task", "bounty"];
export declare const taskStatuses: readonly ["open", "assigned", "verifying", "resolved", "cancelled"];
export declare const submissionStatuses: readonly ["queued", "running", "passed", "failed", "rejected"];
export declare const runtimes: readonly ["python", "javascript"];
export declare const createThreadSchema: z.ZodObject<{
    kind: z.ZodEnum<["discussion", "task", "bounty"]>;
    title: z.ZodString;
    body: z.ZodString;
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    kind: "discussion" | "task" | "bounty";
    title: string;
    body: string;
    tags: string[];
}, {
    kind: "discussion" | "task" | "bounty";
    title: string;
    body: string;
    tags?: string[] | undefined;
}>;
export declare const createTaskSchema: z.ZodObject<{
    threadId: z.ZodString;
    runtime: z.ZodEnum<["python", "javascript"]>;
    prompt: z.ZodString;
    testCode: z.ZodString;
    timeoutMs: z.ZodDefault<z.ZodNumber>;
    memoryMb: z.ZodDefault<z.ZodNumber>;
    cpuMillis: z.ZodDefault<z.ZodNumber>;
    bountyCredits: z.ZodDefault<z.ZodNumber>;
    requiredAudits: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    threadId: string;
    runtime: "python" | "javascript";
    prompt: string;
    testCode: string;
    timeoutMs: number;
    memoryMb: number;
    cpuMillis: number;
    bountyCredits: number;
    requiredAudits: number;
}, {
    threadId: string;
    runtime: "python" | "javascript";
    prompt: string;
    testCode: string;
    timeoutMs?: number | undefined;
    memoryMb?: number | undefined;
    cpuMillis?: number | undefined;
    bountyCredits?: number | undefined;
    requiredAudits?: number | undefined;
}>;
export declare const submitSolutionSchema: z.ZodObject<{
    taskId: z.ZodString;
    code: z.ZodString;
    idempotencyKey: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
    taskId: string;
    idempotencyKey: string;
}, {
    code: string;
    taskId: string;
    idempotencyKey: string;
}>;
export declare const createPostSchema: z.ZodObject<{
    threadId: z.ZodString;
    parentPostId: z.ZodOptional<z.ZodString>;
    body: z.ZodString;
}, "strip", z.ZodTypeAny, {
    body: string;
    threadId: string;
    parentPostId?: string | undefined;
}, {
    body: string;
    threadId: string;
    parentPostId?: string | undefined;
}>;
export declare const executionRequestSchema: z.ZodObject<{
    runId: z.ZodString;
    runtime: z.ZodEnum<["python", "javascript"]>;
    source: z.ZodString;
    testSource: z.ZodString;
    limits: z.ZodObject<{
        timeoutMs: z.ZodNumber;
        memoryMb: z.ZodNumber;
        cpuMillis: z.ZodNumber;
        pids: z.ZodDefault<z.ZodNumber>;
        outputBytes: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        timeoutMs: number;
        memoryMb: number;
        cpuMillis: number;
        pids: number;
        outputBytes: number;
    }, {
        timeoutMs: number;
        memoryMb: number;
        cpuMillis: number;
        pids?: number | undefined;
        outputBytes?: number | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    runtime: "python" | "javascript";
    runId: string;
    source: string;
    testSource: string;
    limits: {
        timeoutMs: number;
        memoryMb: number;
        cpuMillis: number;
        pids: number;
        outputBytes: number;
    };
}, {
    runtime: "python" | "javascript";
    runId: string;
    source: string;
    testSource: string;
    limits: {
        timeoutMs: number;
        memoryMb: number;
        cpuMillis: number;
        pids?: number | undefined;
        outputBytes?: number | undefined;
    };
}>;
export declare const executionResultSchema: z.ZodObject<{
    runId: z.ZodString;
    status: z.ZodEnum<["passed", "failed", "timeout", "internal_error"]>;
    exitCode: z.ZodNullable<z.ZodNumber>;
    durationMs: z.ZodNumber;
    peakMemoryBytes: z.ZodNumber;
    stdout: z.ZodString;
    stderr: z.ZodString;
    assertionsPassed: z.ZodNumber;
    assertionsFailed: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    status: "passed" | "failed" | "timeout" | "internal_error";
    runId: string;
    exitCode: number | null;
    durationMs: number;
    peakMemoryBytes: number;
    stdout: string;
    stderr: string;
    assertionsPassed: number;
    assertionsFailed: number;
}, {
    status: "passed" | "failed" | "timeout" | "internal_error";
    runId: string;
    exitCode: number | null;
    durationMs: number;
    peakMemoryBytes: number;
    stdout: string;
    stderr: string;
    assertionsPassed: number;
    assertionsFailed: number;
}>;
export declare const knowledgeQuerySchema: z.ZodObject<{
    query: z.ZodString;
    limit: z.ZodDefault<z.ZodNumber>;
    minScore: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    query: string;
    limit: number;
    minScore: number;
}, {
    query: string;
    limit?: number | undefined;
    minScore?: number | undefined;
}>;
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
