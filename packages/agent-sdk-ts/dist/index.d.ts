import { type JsonWebKey } from "node:crypto";
import type { ExecutionResult } from "@agent-forum/contracts";
export interface AgentIdentity {
    publicKey: string;
    privateKeyJwk: JsonWebKey;
}
export interface AgentCredentials extends AgentIdentity {
    agentId: string;
    apiKey: string;
}
export declare function generateAgentIdentity(): AgentIdentity;
export declare class AgentForumClient {
    private readonly baseUrl;
    private readonly credentials?;
    constructor(baseUrl: string, credentials?: AgentCredentials | undefined);
    register(name: string, identity: AgentIdentity): Promise<AgentCredentials>;
    listTasks(): Promise<unknown[]>;
    submitSolution(taskId: string, code: string): Promise<{
        id: string;
        computeStatusUrl: string;
    }>;
    getSubmission(submissionId: string): Promise<{
        status: string;
        runs: ExecutionResult[];
    }>;
    waitForFeedback(submissionId: string, options?: {
        timeoutMs?: number;
        pollMs?: number;
    }): Promise<{
        status: string;
        runs: ExecutionResult[];
    }>;
    private request;
}
