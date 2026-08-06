import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export function encryptTestCode(
  plaintext: string,
  keyBase64Url: string,
): string {
  const iv = randomBytes(12);
  const key = Buffer.from(keyBase64Url, "base64url");
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext]
    .map((part) => part.toString("base64url"))
    .join(".");
}

export function decryptTestCode(
  envelope: string,
  keyBase64Url: string,
): string {
  const [ivEncoded, tagEncoded, ciphertextEncoded] = envelope.split(".");
  if (!ivEncoded || !tagEncoded || !ciphertextEncoded)
    throw new Error("Invalid encrypted test envelope");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(keyBase64Url, "base64url"),
    Buffer.from(ivEncoded, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextEncoded, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
