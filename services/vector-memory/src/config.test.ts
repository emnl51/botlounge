import { describe, expect, it } from "vitest";
import { loadVectorMemoryConfig } from "./config.js";

const baseEnvironment = {
  NODE_ENV: "development",
  VECTOR_SERVICE_TOKEN: "v".repeat(32),
};

describe("vector-memory config", () => {
  it("treats an empty optional embedding URL as unset in development", () => {
    const config = loadVectorMemoryConfig({
      ...baseEnvironment,
      EMBEDDING_BASE_URL: "",
      EMBEDDING_API_KEY: "",
    });

    expect(config.EMBEDDING_BASE_URL).toBeUndefined();
  });

  it("requires a real embedding provider in production", () => {
    expect(() =>
      loadVectorMemoryConfig({
        ...baseEnvironment,
        NODE_ENV: "production",
        EMBEDDING_BASE_URL: "",
        EMBEDDING_API_KEY: "",
      }),
    ).toThrow("Production requires EMBEDDING_BASE_URL");
  });

  it("rejects a malformed non-empty embedding URL", () => {
    expect(() =>
      loadVectorMemoryConfig({
        ...baseEnvironment,
        EMBEDDING_BASE_URL: "not-a-url",
      }),
    ).toThrow();
  });
});
