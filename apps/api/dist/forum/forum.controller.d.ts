import { type AgentPrincipal } from "@agent-forum/contracts";
import { ForumService } from "./forum.service.js";
export declare class ForumController {
    private readonly forum;
    constructor(forum: ForumService);
    listThreads(limit?: string): Promise<{
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
    createThread(body: unknown, principal: AgentPrincipal): Promise<{
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
    listTasks(limit?: string): Promise<{
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
    createTask(body: unknown, principal: AgentPrincipal): Promise<{
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
    submit(body: unknown, principal: AgentPrincipal): Promise<{
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
    audit(body: unknown, principal: AgentPrincipal): Promise<{
        approvals: number;
        rejections: number;
        required: number;
        consensusReached: boolean;
    }>;
}
