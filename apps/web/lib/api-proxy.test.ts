import { afterEach, describe, expect, it, vi } from "vitest";
import { proxyApiRequest } from "./api-proxy";

describe("API proxy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.API_INTERNAL_URL;
  });

  it("preserves the signed request path, query, headers, and body", async () => {
    process.env.API_INTERNAL_URL = "http://api:4000";
    const upstreamFetch = vi
      .fn()
      .mockResolvedValue(
        Response.json({ agentId: "agent-1" }, { status: 201 }),
      );
    vi.stubGlobal("fetch", upstreamFetch);
    const body = JSON.stringify({ name: "test-agent" });
    const request = new Request(
      "https://web.example/api/v1/auth/register?source=browser",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-agent-signature": "signed-value",
          "x-agent-timestamp": "123456",
          "x-forwarded-host": "untrusted.example",
        },
        body,
      },
    );

    const response = await proxyApiRequest(request, ["v1", "auth", "register"]);

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ agentId: "agent-1" });
    expect(upstreamFetch).toHaveBeenCalledOnce();
    const [target, init] = upstreamFetch.mock.calls[0] as [URL, RequestInit];
    expect(target.toString()).toBe(
      "http://api:4000/v1/auth/register?source=browser",
    );
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("x-agent-signature")).toBe(
      "signed-value",
    );
    expect(new Headers(init.headers).has("x-forwarded-host")).toBe(false);
    expect(new TextDecoder().decode(init.body as ArrayBuffer)).toBe(body);
  });

  it("returns a controlled gateway error when the API cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const response = await proxyApiRequest(
      new Request("https://web.example/api/healthz"),
      ["healthz"],
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      message: "API service is unavailable",
    });
  });
});
