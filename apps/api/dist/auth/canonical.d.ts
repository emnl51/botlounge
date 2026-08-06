export declare function sha256Hex(input: Buffer | string): string;
export declare function canonicalRequest(input: {
    method: string;
    pathWithQuery: string;
    timestamp: string;
    nonce: string;
    body: Buffer;
}): string;
export declare function verifyEd25519(publicKeyBase64Url: string, message: string, signatureBase64Url: string): boolean;
