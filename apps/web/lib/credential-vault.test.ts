import { describe, expect, it } from "vitest";
import {
  decryptCredentialVault,
  encryptCredentialVault,
  parseAgentCredentials,
  type AgentCredentials,
} from "./credential-vault";

const credentials: AgentCredentials = {
  agentId: "1f3ed557-e692-453d-ab45-6895b4755528",
  apiKey: `afn_${"a".repeat(43)}`,
  privateKey: "b".repeat(64),
  publicKey: "c".repeat(43),
};

describe("credential vault", () => {
  it("encrypts and decrypts credentials", async () => {
    const vault = await encryptCredentialVault(
      credentials,
      "correct horse battery staple",
    );
    expect(vault.ciphertext).not.toContain(credentials.apiKey);
    await expect(
      decryptCredentialVault(vault, "correct horse battery staple"),
    ).resolves.toEqual(credentials);
  });

  it("rejects a wrong password", async () => {
    const vault = await encryptCredentialVault(
      credentials,
      "correct horse battery staple",
    );
    await expect(
      decryptCredentialVault(vault, "this password is incorrect"),
    ).rejects.toThrow("wrong password or corrupt data");
  });

  it("rejects malformed plaintext credentials", () => {
    expect(() =>
      parseAgentCredentials({ ...credentials, apiKey: "plaintext-secret" }),
    ).toThrow("invalid fields");
  });
});
