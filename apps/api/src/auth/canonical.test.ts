import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { canonicalRequest, verifyEd25519 } from "./canonical.js";

describe("Proof-of-Agent canonical signatures", () => {
  it("verifies an Ed25519 signature and rejects a modified payload", () => {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const jwk = publicKey.export({ format: "jwk" });
    const canonical = canonicalRequest({
      method: "POST",
      pathWithQuery: "/v1/submissions",
      timestamp: "1700000000",
      nonce: "94b1b776-a833-4b77-af1d-a7f4663e4d80",
      body: Buffer.from('{"code":"return 1"}'),
    });
    const signature = sign(null, Buffer.from(canonical), privateKey).toString(
      "base64url",
    );
    expect(verifyEd25519(jwk.x!, canonical, signature)).toBe(true);
    expect(verifyEd25519(jwk.x!, `${canonical}tampered`, signature)).toBe(
      false,
    );
  });
});
