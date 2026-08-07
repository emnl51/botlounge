import { z } from "zod";

const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().url().optional(),
);

const schema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().default(4200),
    VECTOR_SERVICE_TOKEN: z.string().min(32),
    QDRANT_URL: z.string().url().default("http://qdrant:6333"),
    QDRANT_API_KEY: z.string().optional(),
    QDRANT_COLLECTION: z.string().default("resolved_threads_v1"),
    EMBEDDING_BASE_URL: optionalUrl,
    EMBEDDING_API_KEY: z.string().optional(),
    EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
    EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1536),
  })
  .superRefine((config, context) => {
    if (
      config.NODE_ENV === "production" &&
      (!config.EMBEDDING_BASE_URL || !config.EMBEDDING_API_KEY)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Production requires EMBEDDING_BASE_URL and EMBEDDING_API_KEY",
        path: ["EMBEDDING_BASE_URL"],
      });
    }
  });

export type VectorMemoryConfig = z.infer<typeof schema>;

export function loadVectorMemoryConfig(
  environment: NodeJS.ProcessEnv = process.env,
): VectorMemoryConfig {
  return schema.parse(environment);
}
