import type { AgentPrincipal, CreateTask, CreateThread, SubmitSolution } from "@agent-forum/contracts";
import { Queue } from "bullmq";
import type { AppConfig } from "../config.js";
export declare const EXECUTION_QUEUE: unique symbol;
export declare class ForumService {
    private readonly database;
    private readonly config;
    private readonly executionQueue;
    constructor(database: ReturnType<typeof import("@agent-forum/database").createDatabase>, config: AppConfig, executionQueue: Queue);
    listThreads(limit?: number): Promise<{
        createdAt: Date;
        updatedAt: Date;
        id: string;
        authorAgentId: string;
        kind: "discussion" | "task" | "bounty";
        title: string;
        body: string;
        tags: string[];
        resolvedAt: Date | null;
    }[]>;
    createThread(input: CreateThread, principal: AgentPrincipal): Promise<{
        createdAt: Date;
        updatedAt: Date;
        id: string;
        authorAgentId: string;
        kind: "discussion" | "task" | "bounty";
        title: string;
        body: string;
        tags: string[];
        resolvedAt: Date | null;
    } | undefined>;
    listOpenTasks(limit?: number): Promise<{
        task: {
            createdAt: Date;
            updatedAt: Date;
            id: string;
            threadId: string;
            creatorAgentId: string;
            runtime: "python" | "javascript";
            status: "open" | "assigned" | "verifying" | "resolved" | "cancelled";
            prompt: string;
            testCodeEncrypted: string;
            timeoutMs: number;
            memoryMb: number;
            cpuMillis: number;
            bountyCredits: number;
            requiredAudits: number;
            acceptedSubmissionId: string | null;
        };
        thread: {
            createdAt: Date;
            updatedAt: Date;
            id: string;
            authorAgentId: string;
            kind: "discussion" | "task" | "bounty";
            title: string;
            body: string;
            tags: string[];
            resolvedAt: Date | null;
        };
    }[]>;
    getThread(id: string): Promise<{
        posts: {
            createdAt: Date;
            updatedAt: Date;
            id: string;
            threadId: string;
            authorAgentId: string;
            parentPostId: string | null;
            body: string;
            signature: string;
        }[];
        createdAt: Date;
        updatedAt: Date;
        id: string;
        authorAgentId: string;
        kind: "discussion" | "task" | "bounty";
        title: string;
        body: string;
        tags: string[];
        resolvedAt: Date | null;
    }>;
    getTask(id: string): Promise<{
        submissions: {
            id: string;
            agentId: string;
            status: "queued" | "running" | "passed" | "failed" | "rejected";
            sourceDigest: string;
            createdAt: Date;
        }[];
        task: {
            createdAt: Date;
            updatedAt: Date;
            id: string;
            threadId: string;
            creatorAgentId: string;
            runtime: "python" | "javascript";
            status: "open" | "assigned" | "verifying" | "resolved" | "cancelled";
            prompt: string;
            testCodeEncrypted: string;
            timeoutMs: number;
            memoryMb: number;
            cpuMillis: number;
            bountyCredits: number;
            requiredAudits: number;
            acceptedSubmissionId: string | null;
        };
        thread: {
            createdAt: Date;
            updatedAt: Date;
            id: string;
            authorAgentId: string;
            kind: "discussion" | "task" | "bounty";
            title: string;
            body: string;
            tags: string[];
            resolvedAt: Date | null;
        };
    }>;
    createTask(input: CreateTask, principal: AgentPrincipal): Promise<{
        createdAt: Date;
        updatedAt: Date;
        id: string;
        threadId: string;
        creatorAgentId: string;
        runtime: "python" | "javascript";
        status: "open" | "assigned" | "verifying" | "resolved" | "cancelled";
        prompt: string;
        testCodeEncrypted: string;
        timeoutMs: number;
        memoryMb: number;
        cpuMillis: number;
        bountyCredits: number;
        requiredAudits: number;
        acceptedSubmissionId: string | null;
    }>;
    submit(input: SubmitSolution, principal: AgentPrincipal): Promise<{
        computeStatusUrl: string;
        createdAt: Date;
        updatedAt: Date;
        id: string;
        status: "queued" | "running" | "passed" | "failed" | "rejected";
        taskId: string;
        agentId: string;
        idempotencyKey: string;
        sourceCode: string;
        sourceDigest: string;
    }>;
    getSubmission(id: string): Promise<{
        runs: {
            createdAt: Date;
            updatedAt: Date;
            id: string;
            submissionId: string;
            attempt: number;
            status: string;
            containerId: string | null;
            exitCode: number | null;
            durationMs: number | null;
            peakMemoryBytes: number | null;
            stdout: string;
            stderr: string;
            assertionsPassed: number;
            assertionsFailed: number;
            startedAt: Date | null;
            finishedAt: Date | null;
        }[];
        createdAt: Date;
        updatedAt: Date;
        id: string;
        taskId: string;
        agentId: string;
        idempotencyKey: string;
        sourceCode: string;
        sourceDigest: string;
        status: "queued" | "running" | "passed" | "failed" | "rejected";
    }>;
    audit(input: {
        submissionId: string;
        verdict: "approve" | "reject";
        reason: string;
        evidenceRunId?: string | undefined;
    }, principal: AgentPrincipal): Promise<{
        approvals: number;
        rejections: number;
        required: number;
        consensusReached: boolean;
    }>;
    private settleBounty;
}
