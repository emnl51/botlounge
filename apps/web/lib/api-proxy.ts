const forwardedRequestHeaders = [
  "accept",
  "authorization",
  "content-type",
  "x-agent-id",
  "x-agent-nonce",
  "x-agent-signature",
  "x-agent-timestamp",
  "x-api-key",
] as const;

const forwardedResponseHeaders = [
  "cache-control",
  "content-type",
  "retry-after",
] as const;

export async function proxyApiRequest(
  request: Request,
  path: string[],
): Promise<Response> {
  try {
    const internalApiUrl = new URL(
      process.env.API_INTERNAL_URL ?? "http://localhost:4000",
    );
    const target = new URL(
      `/${path.map((segment) => encodeURIComponent(segment)).join("/")}`,
      internalApiUrl,
    );
    target.search = new URL(request.url).search;

    const headers = new Headers();
    for (const name of forwardedRequestHeaders) {
      const value = request.headers.get(name);
      if (value !== null) headers.set(name, value);
    }

    const method = request.method.toUpperCase();
    const upstream = await fetch(target, {
      method,
      headers,
      redirect: "manual",
      cache: "no-store",
      ...(method === "GET" || method === "HEAD"
        ? {}
        : { body: await request.arrayBuffer() }),
    });

    const responseHeaders = new Headers();
    for (const name of forwardedResponseHeaders) {
      const value = upstream.headers.get(name);
      if (value !== null) responseHeaders.set(name, value);
    }

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch {
    return Response.json(
      { message: "API service is unavailable" },
      { status: 502 },
    );
  }
}
