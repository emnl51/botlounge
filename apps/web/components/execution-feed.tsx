"use client";

import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

interface Event {
  type: string;
  data: unknown;
  at: string;
}

interface DemoStep {
  type: "status" | "stdout" | "stderr" | "metrics";
  data: unknown;
  delay: number;
}

const DEMO_STEPS: DemoStep[] = [
  { type: "status", data: "queued", delay: 0 },
  { type: "status", data: "running", delay: 600 },
  { type: "stdout", data: "$ python -m unittest test_solution.py -v", delay: 1200 },
  { type: "stdout", data: "test_add_positive (test_solution) ... ok", delay: 2000 },
  { type: "stdout", data: "test_add_negative (test_solution) ... ok", delay: 2600 },
  { type: "stdout", data: "test_add_zero (test_solution) ... ok", delay: 3200 },
  { type: "stdout", data: "Ran 3 tests in 0.04s", delay: 3900 },
  { type: "stdout", data: "OK", delay: 4300 },
  { type: "metrics", data: { durationMs: 412, peakMemoryBytes: 18350080 }, delay: 4700 },
  { type: "status", data: "passed", delay: 5100 },
];

export function ExecutionFeed({ runId }: { runId?: string }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLive, setIsLive] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (runId) {
      setIsLive(true);
      const socket = io(
        `${process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:4000"}/execution`,
        { transports: ["websocket"], auth: { runId } },
      );
      socket.on("execution.event", (event: Event) =>
        setEvents((current) => [...current.slice(-99), event]),
      );
      return () => {
        socket.close();
      };
    }

    setIsLive(false);
    setEvents([]);
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const step of DEMO_STEPS) {
      timers.push(
        setTimeout(() => {
          setEvents((current) => [...current.slice(-99), {
            type: step.type,
            data: step.data,
            at: new Date().toISOString(),
          }]);
        }, step.delay),
      );
    }
    const loopTimer = setTimeout(() => {
      setEvents([]);
    }, 8000);
    timers.push(loopTimer);
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [runId]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [events]);

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#070b0f] font-mono text-xs shadow-glow">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-muted-foreground">
        <span className="flex items-center gap-2">
          <i className={`h-2 w-2 rounded-full ${isLive ? "bg-emerald-400 animate-pulse" : "bg-sky-400 animate-pulse"}`} />
          {isLive ? "live execution stream" : "sample execution stream"}
        </span>
        {!isLive && (
          <span className="text-[10px] uppercase tracking-wider text-slate-600">demo</span>
        )}
      </div>
      <div
        ref={containerRef}
        className="h-64 space-y-1 overflow-y-auto p-4 text-slate-300"
      >
        {events.length === 0 ? (
          <p className="text-slate-500">Initializing sandbox…</p>
        ) : (
          events.map((event, index) => (
            <p key={`${event.at}-${index}`} className="leading-relaxed">
              <span className="text-emerald-400">[{event.type}]</span>{" "}
              {typeof event.data === "string"
                ? event.data
                : JSON.stringify(event.data)}
            </p>
          ))
        )}
      </div>
    </div>
  );
}
