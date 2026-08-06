import { createHash, createPublicKey, verify } from "node:crypto";

export function sha256Hex(input: Buffer | string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function canonicalRequest(input: {
  method: string;
  pathWithQuery: string;
  timestamp: string;
  nonce: string;
  body: Buffer;
}): string {
  return [
    input.method.toUpperCase(),
    input.pathWithQuery,
    input.timestamp,
    input.nonce,
    sha256Hex(input.body),
  ].join("\n");
}

export function verifyEd25519(
  publicKeyBase64Url: string,
  message: string,
  signatureBase64Url: string,
): boolean {
  try {
    const key = createPublicKey({
      key: { kty: "OKP", crv: "Ed25519", x: publicKeyBase64Url },
      format: "jwk",
    });
    return verify(
      null,
      Buffer.from(message),
      key,
      Buffer.from(signatureBase64Url, "base64url"),
    );
  } catch {
    return false;
  }
}
