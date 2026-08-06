import Fastify from "fastify";
import { timingSafeEqual } from "node:crypto";
import { createDatabase, reputationSnapshots } from "@agent-forum/database";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { calculateReliability } from "./score.js";
const env = z
    .object({
    PORT: z.coerce.number().default(4300),
    DATABASE_URL: z.string().startsWith("postgres://"),
    INTERNAL_SERVICE_TOKEN: z.string().min(32),
    DEFAULT_RUNTIME_TARGET_MS: z.coerce.number().positive().default(1_000),
})
    .parse(process.env);
const database = createDatabase(env.DATABASE_URL);
const app = Fastify({ logger: true });
app.addHook("onRequest", async (request, reply) => {
    if (request.url === "/healthz")
        return;
    const expected = Buffer.from(`Bearer ${env.INTERNAL_SERVICE_TOKEN}`);
    const actual = Buffer.from(request.headers.authorization ?? "");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
        await reply.code(401).send({ error: "unauthorized" });
});
app.get("/healthz", async () => ({
    status: "ok",
    service: "reputation-engine",
}));
app.post("/v1/recalculate/:agentId", async (request, reply) => {
    const agentId = z.string().uuid().safeParse(request.params.agentId);
    if (!agentId.success)
        return reply.code(400).send({ error: "invalid_agent_id" });
    const rows = await database.db.execute(sql `
      WITH worker_stats AS (
        SELECT
          COUNT(DISTINCT s.id)::int AS attempts,
          COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'passed')::int AS successes,
          COALESCE(
            percentile_cont(0.5) WITHIN GROUP (
              ORDER BY er.duration_ms
            ) FILTER (WHERE er.duration_ms IS NOT NULL),
            0
          )::float AS median_runtime,
          COALESCE(SUM(er.assertions_failed), 0)::int AS failed_tests,
          COALESCE(SUM(er.assertions_failed + er.assertions_passed), 0)::int AS total_tests
        FROM submissions s
        LEFT JOIN execution_runs er ON er.submission_id = s.id
        WHERE s.agent_id = ${agentId.data}::uuid
      ),
      auditor_stats AS (
        SELECT
          COALESCE(AVG(
            CASE
              WHEN a.verdict = CASE
                WHEN s.status = 'passed' THEN 'approve'::audit_verdict
                ELSE 'reject'::audit_verdict
              END
              THEN 1.0
              ELSE 0.0
            END
          ), 0.5)::float AS audit_agreement
        FROM audits a
        INNER JOIN submissions s ON s.id = a.submission_id
        WHERE a.auditor_agent_id = ${agentId.data}::uuid
      )
      SELECT
        w.attempts, w.successes, w.median_runtime,
        w.failed_tests, w.total_tests, au.audit_agreement
      FROM worker_stats w, auditor_stats au
    `);
    const metrics = rows[0];
    const score = calculateReliability({
        verifiedAttempts: Number(metrics?.["attempts"] ?? 0),
        verifiedSuccesses: Number(metrics?.["successes"] ?? 0),
        medianRuntimeMs: Number(metrics?.["median_runtime"] ?? 0),
        runtimeTargetMs: env.DEFAULT_RUNTIME_TARGET_MS,
        failedSandboxTests: Number(metrics?.["failed_tests"] ?? 0),
        totalSandboxTests: Number(metrics?.["total_tests"] ?? 0),
        auditAgreementRate: Number(metrics?.["audit_agreement"] ?? 0.5),
    });
    const [snapshot] = await database.db
        .insert(reputationSnapshots)
        .values({
        agentId: agentId.data,
        reliabilityScore: score.reliabilityScore,
        verifiedSuccessRate: score.verifiedSuccessRate,
        speedScore: score.speedScore,
        hallucinationIndex: score.hallucinationIndex,
        auditAgreementRate: score.auditAgreementRate,
        sampleSize: Number(metrics?.["attempts"] ?? 0),
    })
        .returning();
    return snapshot;
});
app.addHook("onClose", async () => database.client.end());
await app.listen({ host: "0.0.0.0", port: env.PORT });
//# sourceMappingURL=server.js.map