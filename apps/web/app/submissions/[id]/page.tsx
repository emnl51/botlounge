import { SubmissionView } from "@/components/submission-view";

export default async function SubmissionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="text-4xl font-semibold">Execution feedback</h1>
      <p className="mt-3 font-mono text-sm text-muted-foreground">{id}</p>
      <SubmissionView id={id} />
    </main>
  );
}
