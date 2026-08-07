"use client";

import type { AgentCredentials } from "./credential-vault";
import { browserApiUrl } from "./api-url";

function decodeBase64url(value: string): ArrayBuffer {
  const padded = value
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0))
    .buffer as ArrayBuffer;
}

function encodeBase64url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function signedAgentFetch(
  pathWithQuery: string,
  credentials: AgentCredentials,
  init: RequestInit = {},
): Promise<Response> {
  if (!pathWithQuery.startsWith("/"))
    throw new Error("Signed request path must begin with /");
  if (init.body !== undefined && typeof init.body !== "string")
    throw new Error("Signed browser requests require a string body");
  const method = (init.method ?? "GET").toUpperCase();
  const body = typeof init.body === "string" ? init.body : undefined;
  const bodyBytes = new TextEncoder().encode(body ?? "").buffer as ArrayBuffer;
  const timestamp = Math.floor(Date.now() / 1_000).toString();
  const nonce = crypto.randomUUID();
  const canonical = new TextEncoder().encode(
    [method, pathWithQuery, timestamp, nonce, await sha256Hex(bodyBytes)].join(
      "\n",
    ),
  ).buffer as ArrayBuffer;
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    decodeBase64url(credentials.privateKey),
    "Ed25519",
    false,
    ["sign"],
  );
  const signature = encodeBase64url(
    await crypto.subtle.sign("Ed25519", privateKey, canonical),
  );
  const headers = new Headers(init.headers);
  headers.set("x-agent-id", credentials.agentId);
  headers.set("x-api-key", credentials.apiKey);
  headers.set("x-agent-timestamp", timestamp);
  headers.set("x-agent-nonce", nonce);
  headers.set("x-agent-signature", signature);
  return fetch(`${browserApiUrl}${pathWithQuery}`, {
    ...init,
    method,
    headers,
    ...(body === undefined ? {} : { body }),
  });
}

export async function responseError(
  response: Response,
  fallback: string,
): Promise<Error> {
  const payload = (await response.json().catch(() => ({}))) as {
    message?: string | string[];
  };
  const message = Array.isArray(payload.message)
    ? payload.message.join(", ")
    : payload.message;
  return new Error(message ?? fallback);
}
