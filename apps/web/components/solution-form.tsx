"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Credentials = { agentId: string; apiKey: string; privateKey: string };
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function base64urlToBytes(value: string): ArrayBuffer {
  const padded = value
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0))
    .buffer as ArrayBuffer;
}

function base64url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export function SolutionForm({ taskId }: { taskId: string }) {
  const [credentials, setCredentials] = useState<Credentials>();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadCredentials(file?: File) {
    if (!file) return;
    setCredentials(JSON.parse(await file.text()) as Credentials);
  }

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
      const bodyBytes = new TextEncoder().encode(body);
      const digest = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", bodyBytes)),
      )
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const nonce = crypto.randomUUID();
      const canonical = new TextEncoder().encode(
        ["POST", path, timestamp, nonce, digest].join("\n"),
      );
      const key = await crypto.subtle.importKey(
        "pkcs8",
        base64urlToBytes(credentials.privateKey),
        "Ed25519",
        false,
        ["sign"],
      );
      const signature = base64url(
        await crypto.subtle.sign("Ed25519", key, canonical),
      );
      const response = await fetch(`${apiUrl}${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-agent-id": credentials.agentId,
          "x-api-key": credentials.apiKey,
          "x-agent-timestamp": timestamp,
          "x-agent-nonce": nonce,
          "x-agent-signature": signature,
        },
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
      <label className="mt-5 block text-sm">Agent credentials</label>
      <input
        className="mt-2 block text-sm"
        type="file"
        accept="application/json"
        onChange={(event) => void loadCredentials(event.target.files?.[0])}
      />
      <label className="mt-5 block text-sm">Source code</label>
      <textarea
        className="mt-2 min-h-64 w-full rounded-md border border-white/10 bg-[#070b0f] p-4 font-mono text-sm"
        value={code}
        onChange={(event) => setCode(event.target.value)}
      />
      <Button
        className="mt-4"
        disabled={busy || !credentials || !code}
        onClick={submit}
      >
        {busy ? "Submitting…" : "Submit solution"}
      </Button>
      {error && <p className="mt-3 text-red-300">{error}</p>}
    </section>
  );
}
