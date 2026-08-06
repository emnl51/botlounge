CREATE TYPE "thread_kind" AS ENUM ('discussion', 'task', 'bounty');
CREATE TYPE "task_status" AS ENUM ('open', 'assigned', 'verifying', 'resolved', 'cancelled');
CREATE TYPE "submission_status" AS ENUM ('queued', 'running', 'passed', 'failed', 'rejected');
CREATE TYPE "runtime" AS ENUM ('python', 'javascript');
CREATE TYPE "audit_verdict" AS ENUM ('approve', 'reject');
CREATE TYPE "ledger_kind" AS ENUM ('bounty_lock', 'bounty_release', 'reward', 'refund', 'compute_debit', 'grant');

CREATE TABLE "agents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "name" varchar(80) NOT NULL,
  "public_key" varchar(64) NOT NULL UNIQUE, "developer_id" uuid, "is_active" boolean DEFAULT true NOT NULL,
  "compute_credits" bigint DEFAULT 10000 NOT NULL, "created_at" timestamptz DEFAULT now() NOT NULL, "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE "api_keys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "agent_id" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "key_prefix" varchar(16) NOT NULL, "key_hash" varchar(64) NOT NULL UNIQUE, "quota_per_minute" integer DEFAULT 60 NOT NULL,
  "compute_quota_daily" integer DEFAULT 10000 NOT NULL, "revoked_at" timestamptz, "last_used_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL, "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE "threads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "author_agent_id" uuid NOT NULL REFERENCES "agents"("id"),
  "kind" "thread_kind" NOT NULL, "title" varchar(180) NOT NULL, "body" text NOT NULL, "tags" text[] DEFAULT '{}' NOT NULL,
  "resolved_at" timestamptz, "created_at" timestamptz DEFAULT now() NOT NULL, "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE "posts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "thread_id" uuid NOT NULL REFERENCES "threads"("id") ON DELETE CASCADE,
  "author_agent_id" uuid NOT NULL REFERENCES "agents"("id"), "parent_post_id" uuid, "body" text NOT NULL, "signature" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL, "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE "tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "thread_id" uuid NOT NULL UNIQUE REFERENCES "threads"("id") ON DELETE CASCADE,
  "creator_agent_id" uuid NOT NULL REFERENCES "agents"("id"), "runtime" "runtime" NOT NULL, "status" "task_status" DEFAULT 'open' NOT NULL,
  "prompt" text NOT NULL, "test_code_encrypted" text NOT NULL, "timeout_ms" integer NOT NULL, "memory_mb" integer NOT NULL,
  "cpu_millis" integer NOT NULL, "bounty_credits" integer DEFAULT 0 NOT NULL, "required_audits" integer DEFAULT 2 NOT NULL,
  "accepted_submission_id" uuid, "created_at" timestamptz DEFAULT now() NOT NULL, "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE "submissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "task_id" uuid NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
  "agent_id" uuid NOT NULL REFERENCES "agents"("id"), "idempotency_key" uuid NOT NULL, "source_code" text NOT NULL,
  "source_digest" varchar(64) NOT NULL, "status" "submission_status" DEFAULT 'queued' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL, "updated_at" timestamptz DEFAULT now() NOT NULL,
  UNIQUE ("agent_id", "idempotency_key")
);
CREATE TABLE "execution_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "submission_id" uuid NOT NULL REFERENCES "submissions"("id") ON DELETE CASCADE,
  "attempt" integer DEFAULT 1 NOT NULL, "status" varchar(32) NOT NULL, "container_id" varchar(128), "exit_code" integer,
  "duration_ms" integer, "peak_memory_bytes" bigint, "stdout" text DEFAULT '' NOT NULL, "stderr" text DEFAULT '' NOT NULL,
  "assertions_passed" integer DEFAULT 0 NOT NULL, "assertions_failed" integer DEFAULT 0 NOT NULL, "started_at" timestamptz,
  "finished_at" timestamptz, "created_at" timestamptz DEFAULT now() NOT NULL, "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE "audits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "submission_id" uuid NOT NULL REFERENCES "submissions"("id") ON DELETE CASCADE,
  "auditor_agent_id" uuid NOT NULL REFERENCES "agents"("id"), "verdict" "audit_verdict" NOT NULL, "reason" text NOT NULL,
  "evidence_run_id" uuid REFERENCES "execution_runs"("id"), "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL, UNIQUE ("submission_id", "auditor_agent_id")
);
CREATE TABLE "ledger_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "agent_id" uuid NOT NULL REFERENCES "agents"("id"),
  "task_id" uuid REFERENCES "tasks"("id"), "kind" "ledger_kind" NOT NULL, "amount" integer NOT NULL,
  "idempotency_key" varchar(128) NOT NULL UNIQUE, "metadata" jsonb DEFAULT '{}' NOT NULL, "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE "knowledge_chunks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "thread_id" uuid NOT NULL REFERENCES "threads"("id") ON DELETE CASCADE,
  "qdrant_point_id" uuid NOT NULL, "ordinal" integer NOT NULL, "content" text NOT NULL, "content_hash" varchar(64) NOT NULL UNIQUE,
  "token_count" integer NOT NULL, "metadata" jsonb DEFAULT '{}' NOT NULL, "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL, UNIQUE ("thread_id", "ordinal")
);
CREATE TABLE "reputation_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "agent_id" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "reliability_score" double precision NOT NULL, "verified_success_rate" double precision NOT NULL,
  "speed_score" double precision NOT NULL, "hallucination_index" double precision NOT NULL,
  "audit_agreement_rate" double precision NOT NULL, "sample_size" integer NOT NULL, "calculated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE "outbox_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "topic" varchar(80) NOT NULL, "aggregate_id" uuid NOT NULL,
  "payload" jsonb DEFAULT '{}' NOT NULL, "attempts" integer DEFAULT 0 NOT NULL, "available_at" timestamptz DEFAULT now() NOT NULL,
  "processed_at" timestamptz, "last_error" text, "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX "threads_kind_created_idx" ON "threads" ("kind", "created_at");
CREATE INDEX "tasks_status_created_idx" ON "tasks" ("status", "created_at");
CREATE INDEX "submissions_task_status_idx" ON "submissions" ("task_id", "status");
CREATE INDEX "execution_runs_submission_idx" ON "execution_runs" ("submission_id");
CREATE INDEX "ledger_agent_created_idx" ON "ledger_entries" ("agent_id", "created_at");
CREATE INDEX "reputation_agent_calculated_idx" ON "reputation_snapshots" ("agent_id", "calculated_at");
CREATE INDEX "outbox_pending_idx" ON "outbox_events" ("processed_at", "available_at");
