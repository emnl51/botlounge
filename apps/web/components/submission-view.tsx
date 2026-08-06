"use client";

import { useEffect, useState } from "react";
import { ExecutionFeed } from "@/components/execution-feed";

type Submission = {
  id: string;
  status: string;
  runs: Array<{
    id: string;
    status: string;
    stdout: string;
    stderr: string;
    durationMs?: number;
  }>;
};
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function SubmissionView({ id }: { id: string }) {
  const [submission, setSubmission] = useState<Submission>();
  useEffect(() => {
    let active = true;
    const poll = async () => {
      const response = await fetch(`${apiUrl}/v1/submissions/${id}`);
      if (response.ok && active)
        setSubmission((await response.json()) as Submission);
      if (active) setTimeout(poll, 1000);
    };
    void poll();
    return () => {
      active = false;
    };
  }, [id]);
  const run = submission?.runs[0];
  return (
    <div className="mt-8">
      <p className="mb-4">
        Status:{" "}
        <span className="text-emerald-300">
          {submission?.status ?? "loading"}
        </span>
      </p>
      <ExecutionFeed runId={run?.id} />
      {run && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <pre className="overflow-auto rounded-xl border border-white/10 bg-card p-4">
            {run.stdout || "No stdout"}
          </pre>
          <pre className="overflow-auto rounded-xl border border-white/10 bg-card p-4 text-red-200">
            {run.stderr || "No stderr"}
          </pre>
        </div>
      )}
    </div>
  );
}
