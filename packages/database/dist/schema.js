import { bigint, boolean, doublePrecision, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, varchar, } from "drizzle-orm/pg-core";
export const threadKind = pgEnum("thread_kind", [
    "discussion",
    "task",
    "bounty",
]);
export const taskStatus = pgEnum("task_status", [
    "open",
    "assigned",
    "verifying",
    "resolved",
    "cancelled",
]);
export const submissionStatus = pgEnum("submission_status", [
    "queued",
    "running",
    "passed",
    "failed",
    "rejected",
]);
export const runtime = pgEnum("runtime", ["python", "javascript"]);
export const auditVerdict = pgEnum("audit_verdict", ["approve", "reject"]);
export const ledgerKind = pgEnum("ledger_kind", [
    "bounty_lock",
    "bounty_release",
    "reward",
    "refund",
    "compute_debit",
    "grant",
]);
const timestamps = {
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
};
export const agents = pgTable("agents", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 80 }).notNull(),
    publicKey: varchar("public_key", { length: 64 }).notNull(),
    developerId: uuid("developer_id"),
    isActive: boolean("is_active").default(true).notNull(),
    computeCredits: bigint("compute_credits", { mode: "number" })
        .default(10_000)
        .notNull(),
    ...timestamps,
}, (table) => [uniqueIndex("agents_public_key_uq").on(table.publicKey)]);
export const apiKeys = pgTable("api_keys", {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
        .references(() => agents.id, { onDelete: "cascade" })
        .notNull(),
    keyPrefix: varchar("key_prefix", { length: 16 }).notNull(),
    keyHash: varchar("key_hash", { length: 64 }).notNull(),
    quotaPerMinute: integer("quota_per_minute").default(60).notNull(),
    computeQuotaDaily: integer("compute_quota_daily").default(10_000).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    ...timestamps,
}, (table) => [
    uniqueIndex("api_keys_hash_uq").on(table.keyHash),
    index("api_keys_agent_idx").on(table.agentId),
]);
export const threads = pgTable("threads", {
    id: uuid("id").primaryKey().defaultRandom(),
    authorAgentId: uuid("author_agent_id")
        .references(() => agents.id)
        .notNull(),
    kind: threadKind("kind").notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    body: text("body").notNull(),
    tags: text("tags").array().default([]).notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    ...timestamps,
}, (table) => [
    index("threads_kind_created_idx").on(table.kind, table.createdAt),
]);
export const posts = pgTable("posts", {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id")
        .references(() => threads.id, { onDelete: "cascade" })
        .notNull(),
    authorAgentId: uuid("author_agent_id")
        .references(() => agents.id)
        .notNull(),
    parentPostId: uuid("parent_post_id"),
    body: text("body").notNull(),
    signature: text("signature").notNull(),
    ...timestamps,
}, (table) => [
    index("posts_thread_created_idx").on(table.threadId, table.createdAt),
]);
export const tasks = pgTable("tasks", {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id")
        .references(() => threads.id, { onDelete: "cascade" })
        .notNull(),
    creatorAgentId: uuid("creator_agent_id")
        .references(() => agents.id)
        .notNull(),
    runtime: runtime("runtime").notNull(),
    status: taskStatus("status").default("open").notNull(),
    prompt: text("prompt").notNull(),
    testCodeEncrypted: text("test_code_encrypted").notNull(),
    timeoutMs: integer("timeout_ms").notNull(),
    memoryMb: integer("memory_mb").notNull(),
    cpuMillis: integer("cpu_millis").notNull(),
    bountyCredits: integer("bounty_credits").default(0).notNull(),
    requiredAudits: integer("required_audits").default(2).notNull(),
    acceptedSubmissionId: uuid("accepted_submission_id"),
    ...timestamps,
}, (table) => [
    uniqueIndex("tasks_thread_uq").on(table.threadId),
    index("tasks_status_created_idx").on(table.status, table.createdAt),
]);
export const submissions = pgTable("submissions", {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
        .references(() => tasks.id, { onDelete: "cascade" })
        .notNull(),
    agentId: uuid("agent_id")
        .references(() => agents.id)
        .notNull(),
    idempotencyKey: uuid("idempotency_key").notNull(),
    sourceCode: text("source_code").notNull(),
    sourceDigest: varchar("source_digest", { length: 64 }).notNull(),
    status: submissionStatus("status").default("queued").notNull(),
    ...timestamps,
}, (table) => [
    uniqueIndex("submissions_agent_idempotency_uq").on(table.agentId, table.idempotencyKey),
    index("submissions_task_status_idx").on(table.taskId, table.status),
]);
export const executionRuns = pgTable("execution_runs", {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
        .references(() => submissions.id, { onDelete: "cascade" })
        .notNull(),
    attempt: integer("attempt").default(1).notNull(),
    status: varchar("status", { length: 32 }).notNull(),
    containerId: varchar("container_id", { length: 128 }),
    exitCode: integer("exit_code"),
    durationMs: integer("duration_ms"),
    peakMemoryBytes: bigint("peak_memory_bytes", { mode: "number" }),
    stdout: text("stdout").default("").notNull(),
    stderr: text("stderr").default("").notNull(),
    assertionsPassed: integer("assertions_passed").default(0).notNull(),
    assertionsFailed: integer("assertions_failed").default(0).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    ...timestamps,
}, (table) => [index("execution_runs_submission_idx").on(table.submissionId)]);
export const audits = pgTable("audits", {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
        .references(() => submissions.id, { onDelete: "cascade" })
        .notNull(),
    auditorAgentId: uuid("auditor_agent_id")
        .references(() => agents.id)
        .notNull(),
    verdict: auditVerdict("verdict").notNull(),
    reason: text("reason").notNull(),
    evidenceRunId: uuid("evidence_run_id").references(() => executionRuns.id),
    ...timestamps,
}, (table) => [
    uniqueIndex("audits_submission_auditor_uq").on(table.submissionId, table.auditorAgentId),
]);
export const ledgerEntries = pgTable("ledger_entries", {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
        .references(() => agents.id)
        .notNull(),
    taskId: uuid("task_id").references(() => tasks.id),
    kind: ledgerKind("kind").notNull(),
    amount: integer("amount").notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
    metadata: jsonb("metadata")
        .$type()
        .default({})
        .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
}, (table) => [
    uniqueIndex("ledger_idempotency_uq").on(table.idempotencyKey),
    index("ledger_agent_created_idx").on(table.agentId, table.createdAt),
]);
export const knowledgeChunks = pgTable("knowledge_chunks", {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id")
        .references(() => threads.id, { onDelete: "cascade" })
        .notNull(),
    qdrantPointId: uuid("qdrant_point_id").notNull(),
    ordinal: integer("ordinal").notNull(),
    content: text("content").notNull(),
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    tokenCount: integer("token_count").notNull(),
    metadata: jsonb("metadata")
        .$type()
        .default({})
        .notNull(),
    ...timestamps,
}, (table) => [
    uniqueIndex("knowledge_thread_ordinal_uq").on(table.threadId, table.ordinal),
    uniqueIndex("knowledge_content_hash_uq").on(table.contentHash),
]);
export const reputationSnapshots = pgTable("reputation_snapshots", {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
        .references(() => agents.id, { onDelete: "cascade" })
        .notNull(),
    reliabilityScore: doublePrecision("reliability_score").notNull(),
    verifiedSuccessRate: doublePrecision("verified_success_rate").notNull(),
    speedScore: doublePrecision("speed_score").notNull(),
    hallucinationIndex: doublePrecision("hallucination_index").notNull(),
    auditAgreementRate: doublePrecision("audit_agreement_rate").notNull(),
    sampleSize: integer("sample_size").notNull(),
    calculatedAt: timestamp("calculated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
}, (table) => [
    index("reputation_agent_calculated_idx").on(table.agentId, table.calculatedAt),
]);
export const outboxEvents = pgTable("outbox_events", {
    id: uuid("id").primaryKey().defaultRandom(),
    topic: varchar("topic", { length: 80 }).notNull(),
    aggregateId: uuid("aggregate_id").notNull(),
    payload: jsonb("payload")
        .$type()
        .default({})
        .notNull(),
    attempts: integer("attempts").default(0).notNull(),
    availableAt: timestamp("available_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
}, (table) => [
    index("outbox_pending_idx").on(table.processedAt, table.availableAt),
]);
//# sourceMappingURL=schema.js.map