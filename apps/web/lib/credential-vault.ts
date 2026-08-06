"use client";

export interface AgentCredentials {
  agentId: string;
  apiKey: string;
  privateKey: string;
  publicKey?: string;
}

export interface CredentialVault {
  kind: "agent-forum-credential-vault";
  version: 1;
  kdf: {
    name: "PBKDF2";
    hash: "SHA-256";
    iterations: number;
    salt: string;
  };
  cipher: {
    name: "AES-GCM";
    iv: string;
  };
  ciphertext: string;
}

const STORAGE_KEY = "agent-forum:credential-vault";
const AAD = new TextEncoder().encode("agent-forum-credential-vault:v1");
const KDF_ITERATIONS = 600_000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

function encodeBase64url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function decodeBase64url(value: string): ArrayBuffer {
  if (!BASE64URL_PATTERN.test(value)) throw new Error("Invalid base64url data");
  const padded = value
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0))
    .buffer as ArrayBuffer;
}

function randomBytes(length: number): ArrayBuffer {
  return crypto.getRandomValues(new Uint8Array(length)).buffer as ArrayBuffer;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseAgentCredentials(value: unknown): AgentCredentials {
  if (!isRecord(value)) throw new Error("Credential file is malformed");
  const { agentId, apiKey, privateKey, publicKey } = value;
  if (
    typeof agentId !== "string" ||
    !UUID_PATTERN.test(agentId) ||
    typeof apiKey !== "string" ||
    !/^afn_[A-Za-z0-9_-]{43}$/.test(apiKey) ||
    typeof privateKey !== "string" ||
    privateKey.length < 40 ||
    privateKey.length > 256 ||
    !BASE64URL_PATTERN.test(privateKey) ||
    (publicKey !== undefined &&
      (typeof publicKey !== "string" ||
        publicKey.length !== 43 ||
        !BASE64URL_PATTERN.test(publicKey)))
  )
    throw new Error("Credential file contains invalid fields");
  return {
    agentId,
    apiKey,
    privateKey,
    ...(typeof publicKey === "string" ? { publicKey } : {}),
  };
}

function parseVault(value: unknown): CredentialVault {
  if (!isRecord(value) || !isRecord(value["kdf"]) || !isRecord(value["cipher"]))
    throw new Error("Credential vault is malformed");
  const kdf = value["kdf"];
  const cipher = value["cipher"];
  if (
    value["kind"] !== "agent-forum-credential-vault" ||
    value["version"] !== 1 ||
    kdf["name"] !== "PBKDF2" ||
    kdf["hash"] !== "SHA-256" ||
    typeof kdf["iterations"] !== "number" ||
    kdf["iterations"] < 100_000 ||
    kdf["iterations"] > 2_000_000 ||
    typeof kdf["salt"] !== "string" ||
    cipher["name"] !== "AES-GCM" ||
    typeof cipher["iv"] !== "string" ||
    typeof value["ciphertext"] !== "string"
  )
    throw new Error("Credential vault uses an unsupported format");
  return value as unknown as CredentialVault;
}

async function deriveKey(
  password: string,
  salt: ArrayBuffer,
  iterations: number,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptCredentialVault(
  credentials: AgentCredentials,
  password: string,
): Promise<CredentialVault> {
  if (password.length < 12)
    throw new Error("Vault password must contain at least 12 characters");
  const validated = parseAgentCredentials(credentials);
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveKey(password, salt, KDF_ITERATIONS);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: AAD, tagLength: 128 },
    key,
    new TextEncoder().encode(JSON.stringify(validated)),
  );
  return {
    kind: "agent-forum-credential-vault",
    version: 1,
    kdf: {
      name: "PBKDF2",
      hash: "SHA-256",
      iterations: KDF_ITERATIONS,
      salt: encodeBase64url(salt),
    },
    cipher: { name: "AES-GCM", iv: encodeBase64url(iv) },
    ciphertext: encodeBase64url(ciphertext),
  };
}

export async function decryptCredentialVault(
  value: unknown,
  password: string,
): Promise<AgentCredentials> {
  try {
    const vault = parseVault(value);
    const key = await deriveKey(
      password,
      decodeBase64url(vault.kdf.salt),
      vault.kdf.iterations,
    );
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: decodeBase64url(vault.cipher.iv),
        additionalData: AAD,
        tagLength: 128,
      },
      key,
      decodeBase64url(vault.ciphertext),
    );
    return parseAgentCredentials(
      JSON.parse(new TextDecoder().decode(plaintext)) as unknown,
    );
  } catch {
    throw new Error("Unable to unlock vault: wrong password or corrupt data");
  }
}

export function hasCredentialVault(): boolean {
  return (
    typeof window !== "undefined" &&
    window.localStorage.getItem(STORAGE_KEY) !== null
  );
}

export function readCredentialVault(): CredentialVault {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) throw new Error("No credential vault is stored in this browser");
  return parseVault(JSON.parse(raw) as unknown);
}

export async function saveCredentialVault(
  credentials: AgentCredentials,
  password: string,
): Promise<CredentialVault> {
  const vault = await encryptCredentialVault(credentials, password);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(vault));
  return vault;
}

export async function unlockCredentialVault(
  password: string,
): Promise<AgentCredentials> {
  return decryptCredentialVault(readCredentialVault(), password);
}

export async function importCredentialBackup(
  raw: string,
  password: string,
): Promise<AgentCredentials> {
  const parsed = JSON.parse(raw) as unknown;
  if (isRecord(parsed) && parsed["kind"] === "agent-forum-credential-vault") {
    const vault = parseVault(parsed);
    const credentials = await decryptCredentialVault(vault, password);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(vault));
    return credentials;
  }
  const credentials = parseAgentCredentials(parsed);
  await saveCredentialVault(credentials, password);
  return credentials;
}

export function clearCredentialVault(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
