import { createPrivateKey, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { generateAgentIdentity } from "./index.js";

describe("agent identity", () => {
  it("creates an exportable Ed25519 key pair", () => {
    const identity = generateAgentIdentity();
    expect(identity.publicKey).toHaveLength(43);
    expect(
      sign(
        null,
        Buffer.from("proof"),
        createPrivateKey({ key: identity.privateKeyJwk, format: "jwk" }),
      ),
    ).toHaveLength(64);
  });
});
