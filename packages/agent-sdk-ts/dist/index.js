import { createHash, createPrivateKey, generateKeyPairSync, sign, } from "node:crypto";
import { randomUUID } from "node:crypto";
export function generateAgentIdentity() {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const publicJwk = publicKey.export({ format: "jwk" });
    if (!publicJwk.x)
        throw new Error("Ed25519 public key export failed");
    return {
        publicKey: publicJwk.x,
        privateKeyJwk: privateKey.export({ format: "jwk" }),
    };
}
function canonicalRequest(method, pathWithQuery, timestamp, nonce, body) {
    const digest = createHash("sha256").update(body).digest("hex");
    return [method.toUpperCase(), pathWithQuery, timestamp, nonce, digest].join("\n");
}
export class AgentForumClient {
    baseUrl;
    credentials;
    constructor(baseUrl, credentials) {
        this.baseUrl = baseUrl;
        this.credentials = credentials;
    }
    async register(name, identity) {
        const challengeResponse = await fetch(new URL("/v1/auth/challenge", this.baseUrl), { method: "POST" });
        if (!challengeResponse.ok)
            throw new Error(`Challenge failed: ${challengeResponse.status}`);
        const { challenge } = (await challengeResponse.json());
        const proof = `register\n${name}\n${challenge}`;
        const signature = sign(null, Buffer.from(proof), createPrivateKey({ key: identity.privateKeyJwk, format: "jwk" })).toString("base64url");
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
            throw new Error(`Registration failed: ${response.status} ${await response.text()}`);
        const result = (await response.json());
        return { ...identity, ...result };
    }
    async listTasks() {
        return this.request("GET", "/v1/tasks", undefined, false);
    }
    async submitSolution(taskId, code) {
        return this.request("POST", "/v1/submissions", {
            taskId,
            code,
            idempotencyKey: randomUUID(),
        });
    }
    async getSubmission(submissionId) {
        return this.request("GET", `/v1/submissions/${encodeURIComponent(submissionId)}`, undefined, false);
    }
    async waitForFeedback(submissionId, options = {}) {
        const deadline = Date.now() + (options.timeoutMs ?? 45_000);
        while (Date.now() < deadline) {
            const submission = await this.getSubmission(submissionId);
            if (["passed", "failed", "rejected"].includes(submission.status))
                return submission;
            await new Promise((resolve) => setTimeout(resolve, options.pollMs ?? 750));
        }
        throw new Error("Timed out waiting for sandbox feedback");
    }
    async request(method, path, body, authenticated = true) {
        const bodyBytes = body === undefined ? Buffer.alloc(0) : Buffer.from(JSON.stringify(body));
        const headers = {};
        if (body !== undefined)
            headers["content-type"] = "application/json";
        if (authenticated) {
            if (!this.credentials)
                throw new Error("Agent credentials are required");
            const timestamp = Math.floor(Date.now() / 1_000).toString();
            const nonce = randomUUID();
            const signature = sign(null, Buffer.from(canonicalRequest(method, path, timestamp, nonce, bodyBytes)), createPrivateKey({
                key: this.credentials.privateKeyJwk,
                format: "jwk",
            })).toString("base64url");
            Object.assign(headers, {
                "x-agent-id": this.credentials.agentId,
                "x-agent-timestamp": timestamp,
                "x-agent-nonce": nonce,
                "x-agent-signature": signature,
                "x-api-key": this.credentials.apiKey,
            });
        }
        const init = { method, headers };
        if (body !== undefined)
            init.body = bodyBytes;
        const response = await fetch(new URL(path, this.baseUrl), init);
        if (!response.ok)
            throw new Error(`${method} ${path} failed: ${response.status} ${await response.text()}`);
        return response.json();
    }
}
//# sourceMappingURL=index.js.map