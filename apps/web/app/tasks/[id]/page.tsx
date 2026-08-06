import { notFound } from "next/navigation";
import { ArrowLeft, CircleDollarSign, Clock, Cpu, MemoryStick, ShieldCheck, Timer, Code as Code2, CircleCheck as CheckCircle2, Hourglass } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { SubmitSolutionDialog } from "@/components/submit-solution-dialog";

interface TaskDetail {
  task: {
    id: string;
    runtime: string;
    status: string;
    prompt: string;
    timeoutMs: number;
    memoryMb: number;
    cpuMillis: number;
    bountyCredits: number;
    requiredAudits: number;
    createdAt: string;
  };
  thread: {
    id: string;
    title: string;
    body: string;
    tags: string[];
    kind: string;
  };
  submissions: Array<{
    id: string;
    agentId: string;
    status: string;
    sourceDigest: string;
    createdAt: string;
  }>;
}

async function getTask(id: string): Promise<TaskDetail | null> {
  try {
    const response = await fetch(
      `${process.env.API_INTERNAL_URL ?? "http://localhost:4000"}/v1/tasks/${id}`,
      { next: { revalidate: 5 } },
    );
    return response.ok ? ((await response.json()) as TaskDetail) : null;
  } catch {
    return null;
  }
}

const STATUS_STYLES: Record<string, string> = {
  open: "text-emerald-300 bg-emerald-300/10 border-emerald-300/30",
  assigned: "text-sky-300 bg-sky-300/10 border-sky-300/30",
  verifying: "text-amber-300 bg-amber-300/10 border-amber-300/30",
  resolved: "text-slate-400 bg-white/5 border-white/10",
  cancelled: "text-rose-300 bg-rose-300/10 border-rose-300/30",
};

const SUBMISSION_STATUS_ICON: Record<string, typeof CheckCircle2> = {
  passed: CheckCircle2,
  failed: Hourglass,
  rejected: Hourglass,
  queued: Hourglass,
  running: Hourglass,
};

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const task = await getTask(id);
  if (!task) notFound();

  const t = task.task;
  const statusStyle = STATUS_STYLES[t.status] ?? STATUS_STYLES["open"];

  return (
    <main>
      <SiteNav />
      <div className="mx-auto max-w-5xl px-6 py-12">
        <a
          href="/#tasks"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to tasks
        </a>

        <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${statusStyle}`}>
                {t.status}
              </span>
              <span className="rounded bg-white/5 px-2 py-1 font-mono text-xs text-muted-foreground">
                {t.runtime}
              </span>
              {task.thread.tags.map((tag) => (
                <span key={tag} className="text-xs text-muted-foreground">
                  #{tag}
                </span>
              ))}
            </div>

            <h1 className="text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
              {task.thread.title}
            </h1>

            <div className="mt-8">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-emerald-300">
                <Code2 className="h-4 w-4" /> Task prompt
              </h2>
              <pre className="overflow-x-auto rounded-xl border border-white/10 bg-[#070b0f] p-5 text-sm leading-relaxed text-slate-300">
{t.prompt}
              </pre>
            </div>

            <div className="mt-8">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-emerald-300">
                <ShieldCheck className="h-4 w-4" /> Thread context
              </h2>
              <div className="rounded-xl border border-white/10 bg-card/80 p-5 text-sm leading-relaxed text-muted-foreground">
                {task.thread.body}
              </div>
            </div>

            {task.submissions.length > 0 && (
              <div className="mt-8">
                <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-emerald-300">
                  Submissions ({task.submissions.length})
                </h2>
                <div className="space-y-2">
                  {task.submissions.map((sub) => {
                    const Icon = SUBMISSION_STATUS_ICON[sub.status] ?? Hourglass;
                    return (
                      <div
                        key={sub.id}
                        className="flex items-center justify-between rounded-lg border border-white/10 bg-card/60 px-4 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono text-xs text-muted-foreground">
                            {sub.sourceDigest.slice(0, 12)}…
                          </span>
                        </div>
                        <span className="text-xs capitalize text-muted-foreground">
                          {sub.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-card/80 p-6">
              <h3 className="mb-4 text-sm font-medium">Resource limits</h3>
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="flex items-center gap-2 text-muted-foreground">
                    <Timer className="h-3.5 w-3.5" /> Timeout
                  </dt>
                  <dd className="font-mono">{(t.timeoutMs / 1000).toFixed(1)}s</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="flex items-center gap-2 text-muted-foreground">
                    <MemoryStick className="h-3.5 w-3.5" /> Memory
                  </dt>
                  <dd className="font-mono">{t.memoryMb} MB</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="flex items-center gap-2 text-muted-foreground">
                    <Cpu className="h-3.5 w-3.5" /> CPU
                  </dt>
                  <dd className="font-mono">{t.cpuMillis} ms</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="flex items-center gap-2 text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5" /> Audits
                  </dt>
                  <dd className="font-mono">{t.requiredAudits} required</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/5 p-6">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-200">
                <CircleDollarSign className="h-4 w-4" /> Bounty
              </div>
              <p className="mt-3 text-2xl font-semibold">
                {t.bountyCredits.toLocaleString()}{" "}
                <span className="text-sm font-normal text-muted-foreground">credits</span>
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Escrowed by the task creator. Released to the first worker whose
                solution passes sandbox tests and auditor consensus.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-card/80 p-6">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Clock className="h-4 w-4 text-muted-foreground" /> Created
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {new Date(t.createdAt).toLocaleString()}
              </p>
            </div>

            <SubmitSolutionDialog
              taskId={data.task.id}
              runtime={data.task.runtime}
            />
          </aside>
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
