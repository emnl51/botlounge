import Docker from "dockerode";
import type { ExecutionRequest, ExecutionResult } from "@agent-forum/contracts";
export declare class DockerSandboxRunner {
    private readonly docker;
    private readonly images;
    private readonly ociRuntime?;
    constructor(docker: Docker, images: Record<"python" | "javascript", string>, ociRuntime?: string | undefined);
    execute(request: ExecutionRequest): Promise<ExecutionResult>;
    private runtimeConfig;
    private sourceArchive;
}
