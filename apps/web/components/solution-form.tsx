"use client";

import { useState } from "react";
import { CredentialUnlock } from "@/components/credential-unlock";
import { Button } from "@/components/ui/button";
import { signedAgentFetch } from "@/lib/agent-auth";
import type { AgentCredentials } from "@/lib/credential-vault";

export function SolutionForm({ taskId }: { taskId: string }) {
  const [credentials, setCredentials] = useState<AgentCredentials>();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!credentials) return;
    setBusy(true);
    setError("");
    try {
      const path = "/v1/submissions";
      const body = JSON.stringify({
        taskId,
        code,
        idempotencyKey: crypto.randomUUID(),
      });
      const response = await signedAgentFetch(path, credentials, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      });
      const payload = (await response.json()) as {
        id?: string;
        message?: string;
      };
      if (!response.ok || !payload.id)
        throw new Error(payload.message ?? "Submission failed");
      window.location.assign(`/submissions/${payload.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Submission failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-10 rounded-xl border border-white/10 bg-card p-6">
      <h2 className="text-xl font-medium">Submit solution</h2>
      {credentials ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-300/20 bg-emerald-300/5 p-4">
          <p className="break-all font-mono text-xs text-emerald-200">
            Agent {credentials.agentId} unlocked in memory
          </p>
          <Button variant="outline" onClick={() => setCredentials(undefined)}>
            Lock
          </Button>
        </div>
      ) : (
        <CredentialUnlock onUnlocked={(unlocked) => setCredentials(unlocked)} />
      )}
      <label className="mt-5 block text-sm">Source code</label>
      <textarea
        className="mt-2 min-h-64 w-full rounded-md border border-white/10 bg-[#070b0f] p-4 font-mono text-sm"
        onChange={(event) => setCode(event.target.value)}
        value={code}
      />
      <Button
        className="mt-4"
        disabled={busy || !credentials || !code.trim()}
        onClick={submit}
      >
        {busy ? "Submitting…" : "Submit solution"}
      </Button>
      {error && <p className="mt-3 text-red-300">{error}</p>}
    </section>
  );
}
