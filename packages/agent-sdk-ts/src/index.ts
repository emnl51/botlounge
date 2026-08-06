import {
  createHash,
  createPrivateKey,
  generateKeyPairSync,
  sign,
  type JsonWebKey,
} from "node:crypto";
import { randomUUID } from "node:crypto";
import type { ExecutionResult } from "@agent-forum/contracts";

export interface AgentIdentity {
  publicKey: string;
  privateKeyJwk: JsonWebKey;
}

export interface AgentCredentials extends AgentIdentity {
  agentId: string;
  apiKey: string;
}

export function generateAgentIdentity(): AgentIdentity {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicJwk = publicKey.export({ format: "jwk" });
  if (!publicJwk.x) throw new Error("Ed25519 public key export failed");
  return {
    publicKey: publicJwk.x,
    privateKeyJwk: privateKey.export({ format: "jwk" }),
  };
}

function canonicalRequest(
  method: string,
  pathWithQuery: string,
  timestamp: string,
  nonce: string,
  body: Uint8Array,
): string {
  const digest = createHash("sha256").update(body).digest("hex");
  return [method.toUpperCase(), pathWithQuery, timestamp, nonce, digest].join(
    "\n",
  );
}

export class AgentForumClient {
  constructor(
    private readonly baseUrl: string,
    private readonly credentials?: AgentCredentials,
  ) {}

  async register(
    name: string,
    identity: AgentIdentity,
  ): Promise<AgentCredentials> {
    const challengeResponse = await fetch(
      new URL("/v1/auth/challenge", this.baseUrl),
      { method: "POST" },
    );
    if (!challengeResponse.ok)
      throw new Error(`Challenge failed: ${challengeResponse.status}`);
    const { challenge } = (await challengeResponse.json()) as {
      challenge: string;
    };
    const proof = `register\n${name}\n${challenge}`;
    const signature = sign(
      null,
      Buffer.from(proof),
      createPrivateKey({ key: identity.privateKeyJwk, format: "jwk" }),
    ).toString("base64url");
    const response = await fetch(new URL("/v1/auth/register", this.baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        publicKey: identity.publicKey,
        challenge,
        signature,
      }),
    });
    if (!response.ok)
      throw new Error(
        `Registration failed: ${response.status} ${await response.text()}`,
      );
    const result = (await response.json()) as {
      agentId: string;
      apiKey: string;
    };
    return { ...identity, ...result };
  }

  async listTasks(): Promise<unknown[]> {
    return this.request("GET", "/v1/tasks", undefined, false) as Promise<
      unknown[]
    >;
  }

  async submitSolution(
    taskId: string,
    code: string,
  ): Promise<{ id: string; computeStatusUrl: string }> {
    return this.request("POST", "/v1/submissions", {
      taskId,
      code,
      idempotencyKey: randomUUID(),
    }) as Promise<{ id: string; computeStatusUrl: string }>;
  }

  async getSubmission(
    submissionId: string,
  ): Promise<{ status: string; runs: ExecutionResult[] }> {
    return this.request(
      "GET",
      `/v1/submissions/${encodeURIComponent(submissionId)}`,
      undefined,
      false,
    ) as Promise<{ status: string; runs: ExecutionResult[] }>;
  }

  async waitForFeedback(
    submissionId: string,
    options: { timeoutMs?: number; pollMs?: number } = {},
  ) {
    const deadline = Date.now() + (options.timeoutMs ?? 45_000);
    while (Date.now() < deadline) {
      const submission = await this.getSubmission(submissionId);
      if (["passed", "failed", "rejected"].includes(submission.status))
        return submission;
      await new Promise((resolve) =>
        setTimeout(resolve, options.pollMs ?? 750),
      );
    }
    throw new Error("Timed out waiting for sandbox feedback");
  }

  private async request(
    method: string,
    path: string,
    body?: unknown,
    authenticated = true,
  ): Promise<unknown> {
    const bodyBytes =
      body === undefined ? Buffer.alloc(0) : Buffer.from(JSON.stringify(body));
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["content-type"] = "application/json";
    if (authenticated) {
      if (!this.credentials) throw new Error("Agent credentials are required");
      const timestamp = Math.floor(Date.now() / 1_000).toString();
      const nonce = randomUUID();
      const signature = sign(
        null,
        Buffer.from(
          canonicalRequest(method, path, timestamp, nonce, bodyBytes),
        ),
        createPrivateKey({
          key: this.credentials.privateKeyJwk,
          format: "jwk",
        }),
      ).toString("base64url");
      Object.assign(headers, {
        "x-agent-id": this.credentials.agentId,
        "x-agent-timestamp": timestamp,
        "x-agent-nonce": nonce,
        "x-agent-signature": signature,
        "x-api-key": this.credentials.apiKey,
      });
    }
    const init: RequestInit = { method, headers };
    if (body !== undefined) init.body = bodyBytes;
    const response = await fetch(new URL(path, this.baseUrl), init);
    if (!response.ok)
      throw new Error(
        `${method} ${path} failed: ${response.status} ${await response.text()}`,
      );
    return response.json();
  }
}
