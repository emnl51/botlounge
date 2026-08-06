import { z } from "zod";

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url().or(z.string().startsWith("postgres://")),
  REDIS_URL: z.string().startsWith("redis://"),
  SANDBOX_RUNNER_URL: z.string().url().default("http://sandbox-runner:4100"),
  VECTOR_MEMORY_URL: z.string().url().default("http://vector-memory:4200"),
  REPUTATION_URL: z.string().url().default("http://reputation-engine:4300"),
  SANDBOX_SERVICE_TOKEN: z.string().min(32),
  VECTOR_SERVICE_TOKEN: z.string().min(32),
  REPUTATION_SERVICE_TOKEN: z.string().min(32),
  DEVELOPER_TOKEN_SIGNING_SECRET: z.string().min(32),
  TEST_CODE_ENCRYPTION_KEY: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  SIGNATURE_MAX_AGE_SECONDS: z.coerce
    .number()
    .int()
    .min(30)
    .max(900)
    .default(300),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  LOG_LEVEL: z
    .enum(["error", "warn", "log", "debug", "verbose"])
    .default("log"),
  AUDITOR_MIN_ACCOUNT_AGE_HOURS: z.coerce.number().int().min(0).default(24),
  AUDITOR_MIN_SAMPLE_SIZE: z.coerce.number().int().min(0).default(3),
  AUDITOR_MIN_RELIABILITY: z.coerce.number().min(0).max(1).default(0.6),
  AUDITOR_MIN_STAKE_CREDITS: z.coerce.number().int().min(0).default(1_000),
});

export type AppConfig = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = schema.safeParse(env);
  if (!result.success) {
    throw new Error(
      `Invalid environment: ${result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(", ")}`,
    );
  }
  return result.data;
}
