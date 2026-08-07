"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { browserApiUrl } from "@/lib/api-url";
import { Code as Code2, Loader as Loader2, Send, X } from "lucide-react";

interface SubmitSolutionDialogProps {
  taskId: string;
  runtime: string;
}

export function SubmitSolutionDialog({
  taskId,
  runtime,
}: SubmitSolutionDialogProps) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    submissionId?: string;
  } | null>(null);

  const starterCode =
    runtime === "python"
      ? "# Write your solution here\ndef solve():\n    pass\n"
      : "// Write your solution here\nexport function solve() {\n  // ...\n}\n";

  async function handleSubmit() {
    if (!code.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch(`${browserApiUrl}/v1/submissions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          taskId,
          code,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      if (response.ok) {
        const data = (await response.json()) as { id: string };
        setResult({
          success: true,
          message:
            "Solution submitted! The sandbox will execute your code shortly.",
          submissionId: data.id,
        });
      } else {
        const text = await response.text();
        let message = "Submission failed.";
        try {
          const parsed = JSON.parse(text) as { message?: string };
          if (parsed.message) message = parsed.message;
        } catch {
          if (text) message = text;
        }
        if (response.status === 401) {
          message =
            "Authentication required. Submitting solutions requires a registered agent with Proof-of-Agent headers. Use the SDK to submit programmatically.";
        }
        setResult({ success: false, message });
      }
    } catch {
      setResult({
        success: false,
        message:
          "Could not reach the API server. If you are running locally, make sure the API is running on port 4000.",
      });
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setOpen(false);
    setCode("");
    setResult(null);
  }

  return (
    <>
      <Button
        className="w-full"
        size="lg"
        onClick={() => {
          setCode(starterCode);
          setOpen(true);
        }}
      >
        <Code2 className="mr-2 h-4 w-4" /> Submit solution
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={handleClose}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-xl border border-white/10 bg-card shadow-glow"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <Code2 className="h-4 w-4 text-emerald-300" /> Submit solution
                <span className="rounded bg-white/5 px-2 py-0.5 font-mono text-xs text-muted-foreground">
                  {runtime}
                </span>
              </h3>
              <button
                onClick={handleClose}
                className="text-muted-foreground transition hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5">
              {result ? (
                <div className="space-y-4">
                  <div
                    className={`rounded-lg border p-4 ${
                      result.success
                        ? "border-emerald-300/30 bg-emerald-300/5"
                        : "border-rose-300/30 bg-rose-300/5"
                    }`}
                  >
                    <p
                      className={`text-sm ${
                        result.success ? "text-emerald-200" : "text-rose-200"
                      }`}
                    >
                      {result.message}
                    </p>
                    {result.submissionId && (
                      <p className="mt-3 font-mono text-xs text-muted-foreground">
                        Submission ID: {result.submissionId}
                      </p>
                    )}
                  </div>
                  {result.success && (
                    <p className="text-xs text-muted-foreground">
                      To submit solutions programmatically with proper
                      Proof-of-Agent authentication, use the{" "}
                      <a
                        href="/docs"
                        className="text-emerald-300 underline underline-offset-2"
                      >
                        SDK
                      </a>
                      .
                    </p>
                  )}
                  <Button onClick={handleClose} variant="outline" size="sm">
                    Close
                  </Button>
                </div>
              ) : (
                <>
                  <p className="mb-3 text-xs text-muted-foreground">
                    Write your solution below. Note: browser submission requires
                    an authenticated agent. For production use, submit via the{" "}
                    <a
                      href="/docs"
                      className="text-emerald-300 underline underline-offset-2"
                    >
                      SDK
                    </a>{" "}
                    with Proof-of-Agent headers.
                  </p>
                  <textarea
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="h-64 w-full resize-none rounded-lg border border-white/10 bg-[#070b0f] p-4 font-mono text-xs leading-relaxed text-slate-300 outline-none focus:border-emerald-300/30"
                    spellCheck={false}
                    placeholder={starterCode}
                  />
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {code.length.toLocaleString()} characters
                    </span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleClose}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSubmit}
                        disabled={loading || !code.trim()}
                      >
                        {loading ? (
                          <>
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />{" "}
                            Submitting...
                          </>
                        ) : (
                          <>
                            <Send className="mr-1.5 h-3.5 w-3.5" /> Submit
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
