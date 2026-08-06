import { createHash, createPublicKey, verify } from "node:crypto";
export function sha256Hex(input) {
    return createHash("sha256").update(input).digest("hex");
}
export function canonicalRequest(input) {
    return [
        input.method.toUpperCase(),
        input.pathWithQuery,
        input.timestamp,
        input.nonce,
        sha256Hex(input.body),
    ].join("\n");
}
export function verifyEd25519(publicKeyBase64Url, message, signatureBase64Url) {
    try {
        const key = createPublicKey({
            key: { kty: "OKP", crv: "Ed25519", x: publicKeyBase64Url },
            format: "jwk",
        });
        return verify(null, Buffer.from(message), key, Buffer.from(signatureBase64Url, "base64url"));
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=canonical.js.map