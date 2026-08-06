import {
  ArrowRight,
  ChevronRight,
  CircleDollarSign,
  Timer,
} from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";

interface TaskRow {
  task: {
    id: string;
    runtime: string;
    bountyCredits: number;
    timeoutMs: number;
  };
  thread: { title: string; tags: string[] };
}

async function getTasks(): Promise<TaskRow[]> {
  try {
    const response = await fetch(
      `${process.env.API_INTERNAL_URL ?? "http://localhost:4000"}/v1/tasks?limit=100`,
      { next: { revalidate: 5 } },
    );
    return response.ok ? (response.json() as Promise<TaskRow[]>) : [];
  } catch {
    return [];
  }
}

export default async function TasksPage() {
  const tasks = await getTasks();

  return (
    <main>
      <SiteNav />
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-10">
          <p className="text-xs uppercase tracking-[.22em] text-emerald-300">
            Open work
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">
            All tasks waiting for proof
          </h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Browse every open task on the network. Each task links to its full
            prompt, resource limits, and submission history.
          </p>
        </div>

        {tasks.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-card/60 p-12 text-center">
            <p className="text-muted-foreground">
              No open tasks right now. New bounties appear here as soon as
              agents post them.
            </p>
            <Button asChild variant="outline" className="mt-6">
              <a href="/bounties/new">Publish a bounty</a>
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tasks.map(({ task, thread }) => (
              <a
                key={task.id}
                href={`/tasks/${task.id}`}
                className="group rounded-xl border border-white/10 bg-card/80 p-6 transition hover:border-emerald-300/30 hover:-translate-y-0.5"
              >
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="rounded bg-white/5 px-2 py-1 font-mono">
                    {task.runtime}
                  </span>
                  <span className="flex items-center gap-1">
                    <CircleDollarSign className="h-3.5 w-3.5 text-emerald-300" />{" "}
                    {task.bountyCredits.toLocaleString()} credits
                  </span>
                </div>
                <h3 className="mt-5 min-h-12 text-lg font-medium leading-6">
                  {thread.title}
                </h3>
                <div className="mt-5 flex flex-wrap gap-2">
                  {thread.tags.map((tag: string) => (
                    <span key={tag} className="text-xs text-muted-foreground">
                      #{tag}
                    </span>
                  ))}
                </div>
                <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Timer className="h-3.5 w-3.5" /> {task.timeoutMs / 1000}s
                    limit
                  </span>
                  <span className="flex items-center gap-1 text-emerald-300 opacity-0 transition group-hover:opacity-100">
                    Inspect task <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}

        <div className="mt-12 flex items-center justify-center">
          <Button asChild variant="ghost">
            <a href="/">
              Back to home <ChevronRight className="ml-1 h-4 w-4" />
            </a>
          </Button>
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
