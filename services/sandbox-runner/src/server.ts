import Docker from "dockerode";
import Fastify from "fastify";
import { timingSafeEqual } from "node:crypto";
import { executionRequestSchema } from "@agent-forum/contracts";
import { z } from "zod";
import { DockerSandboxRunner } from "./runner.js";

const env = z
  .object({
    PORT: z.coerce.number().default(4100),
    INTERNAL_SERVICE_TOKEN: z.string().min(32),
    DOCKER_HOST: z.string().default("/var/run/docker.sock"),
    SANDBOX_PYTHON_IMAGE: z.string().default("python:3.12.10-alpine3.21"),
    SANDBOX_NODE_IMAGE: z.string().default("node:22.14.0-alpine3.21"),
    SANDBOX_RUNTIME: z.string().default(""),
  })
  .parse(process.env);

const docker = env.DOCKER_HOST.startsWith("tcp://")
  ? new Docker({
      host: new URL(env.DOCKER_HOST).hostname,
      port: Number(new URL(env.DOCKER_HOST).port || 2375),
      protocol: "http",
    })
  : new Docker({ socketPath: env.DOCKER_HOST });
async function ensureImage(image: string): Promise<void> {
  try {
    await docker.getImage(image).inspect();
  } catch {
    const stream = await docker.pull(image);
    await new Promise<void>((resolve, reject) =>
      docker.modem.followProgress(stream, (error) =>
        error ? reject(error) : resolve(),
      ),
    );
  }
}

await Promise.all([
  ensureImage(env.SANDBOX_PYTHON_IMAGE),
  ensureImage(env.SANDBOX_NODE_IMAGE),
]);
const runner = new DockerSandboxRunner(
  docker,
  { python: env.SANDBOX_PYTHON_IMAGE, javascript: env.SANDBOX_NODE_IMAGE },
  env.SANDBOX_RUNTIME || undefined,
);
const app = Fastify({
  logger: true,
  bodyLimit: 512 * 1024,
  requestTimeout: 40_000,
});

app.addHook("onRequest", async (request, reply) => {
  if (request.url === "/healthz") return;
  const expected = Buffer.from(`Bearer ${env.INTERNAL_SERVICE_TOKEN}`);
  const actual = Buffer.from(request.headers.authorization ?? "");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    await reply.code(401).send({ error: "unauthorized" });
});

app.get("/healthz", async () => {
  await docker.ping();
  return { status: "ok", service: "sandbox-runner" };
});

app.post("/v1/executions", async (request, reply) => {
  const parsed = executionRequestSchema.safeParse(request.body);
  if (!parsed.success)
    return reply
      .code(400)
      .send({ error: "invalid_request", details: parsed.error.flatten() });
  return runner.execute(parsed.data);
});

await app.listen({ host: "0.0.0.0", port: env.PORT });
