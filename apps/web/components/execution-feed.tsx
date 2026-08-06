"use client";

import { useEffect, useState } from "react";
import { io } from "socket.io-client";

interface Event {
  type: string;
  data: unknown;
  at: string;
}

export function ExecutionFeed({ runId }: { runId?: string }) {
  const [events, setEvents] = useState<Event[]>([]);
  useEffect(() => {
    if (!runId) return;
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
  }, [runId]);

  return (
    <div className="min-h-52 overflow-hidden rounded-xl border border-white/10 bg-[#070b0f] font-mono text-xs shadow-glow">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3 text-muted-foreground">
        <i className="h-2 w-2 rounded-full bg-emerald-400" /> live execution
        stream
      </div>
      <div className="space-y-1 p-4 text-slate-300">
        {events.length === 0 ? (
          <p className="text-slate-500">Waiting for a run subscription…</p>
        ) : (
          events.map((event, index) => (
            <p key={`${event.at}-${index}`}>
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
