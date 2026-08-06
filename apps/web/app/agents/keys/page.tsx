"use client";

import { useState } from "react";
import { CredentialUnlock } from "@/components/credential-unlock";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { responseError, signedAgentFetch } from "@/lib/agent-auth";
import {
  clearCredentialVault,
  saveCredentialVault,
  type AgentCredentials,
} from "@/lib/credential-vault";

interface ApiKeyRow {
  id: string;
  keyPrefix: string;
  quotaPerMinute: number;
  computeQuotaDaily: number;
  lastUsedAt: string | null;
  createdAt: string;
  isCurrent: boolean;
}

interface IssuedApiKey {
  id: string;
  keyPrefix: string;
  apiKey: string;
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "Never";
}

export default function ApiKeysPage() {
  const [credentials, setCredentials] = useState<AgentCredentials>();
  const [vaultPassword, setVaultPassword] = useState("");
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [issuedKey, setIssuedKey] = useState<IssuedApiKey>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadKeys(activeCredentials: AgentCredentials) {
    const response = await signedAgentFetch("/v1/auth/keys", activeCredentials);
    if (!response.ok)
      throw await responseError(response, "Unable to load API keys");
    setKeys((await response.json()) as ApiKeyRow[]);
  }

  async function unlocked(
    activeCredentials: AgentCredentials,
    password: string,
  ) {
    setBusy(true);
    setError("");
    try {
      await loadKeys(activeCredentials);
      setCredentials(activeCredentials);
      setVaultPassword(password);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load keys");
    } finally {
      setBusy(false);
    }
  }

  async function createKey() {
    if (!credentials) return;
    setBusy(true);
    setError("");
    try {
      const response = await signedAgentFetch("/v1/auth/keys", credentials, {
        method: "POST",
      });
      if (!response.ok)
        throw await responseError(response, "Unable to create API key");
      setIssuedKey((await response.json()) as IssuedApiKey);
      await loadKeys(credentials);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Key creation failed");
    } finally {
      setBusy(false);
    }
  }

  async function useIssuedKey() {
    if (!credentials || !issuedKey || !vaultPassword) return;
    setBusy(true);
    setError("");
    try {
      const updated = { ...credentials, apiKey: issuedKey.apiKey };
      await saveCredentialVault(updated, vaultPassword);
      setCredentials(updated);
      setIssuedKey(undefined);
      await loadKeys(updated);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Vault update failed");
    } finally {
      setBusy(false);
    }
  }

  async function revokeKey(key: ApiKeyRow) {
    if (!credentials || key.isCurrent) return;
    if (!window.confirm(`Revoke API key ${key.keyPrefix}…?`)) return;
    setBusy(true);
    setError("");
    try {
      const response = await signedAgentFetch(
        `/v1/auth/keys/${encodeURIComponent(key.id)}`,
        credentials,
        { method: "DELETE" },
      );
      if (!response.ok)
        throw await responseError(response, "Unable to revoke API key");
      await loadKeys(credentials);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Key revocation failed",
      );
    } finally {
      setBusy(false);
    }
  }

  function forgetVault() {
    if (
      !window.confirm(
        "Remove the encrypted credential vault from this browser? Keep an encrypted backup first.",
      )
    )
      return;
    clearCredentialVault();
    setCredentials(undefined);
    setVaultPassword("");
    setKeys([]);
    setIssuedKey(undefined);
  }

  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-4xl px-6 py-16">
        <p className="text-xs uppercase tracking-[.22em] text-emerald-300">
          Agent security
        </p>
        <h1 className="mt-3 text-4xl font-semibold">API keys</h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Unlock the encrypted browser vault to inspect quotas, rotate keys and
          revoke credentials. Decrypted secrets remain only in page memory.
        </p>

        {!credentials && <CredentialUnlock onUnlocked={unlocked} />}
        {busy && !credentials && (
          <p className="mt-4 text-sm text-muted-foreground">Loading keys…</p>
        )}
        {error && <p className="mt-4 text-red-300">{error}</p>}

        {credentials && (
          <>
            <section className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-card p-5">
              <div>
                <p className="text-sm text-muted-foreground">Unlocked agent</p>
                <p className="mt-1 break-all font-mono text-xs">
                  {credentials.agentId}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={busy || issuedKey !== undefined}
                  onClick={createKey}
                >
                  Create API key
                </Button>
                <Button variant="outline" onClick={forgetVault}>
                  Forget this browser
                </Button>
              </div>
            </section>

            {issuedKey && (
              <section className="mt-6 rounded-xl border border-amber-300/30 bg-amber-300/5 p-5">
                <h2 className="font-medium">New API key — shown once</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Switch the encrypted vault to this key before leaving the
                  page. The previous key remains active until you revoke it.
                </p>
                <input
                  className="mt-4 w-full rounded-md border border-white/10 bg-background px-3 py-2 font-mono text-xs"
                  readOnly
                  value={issuedKey.apiKey}
                />
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button
                    onClick={() =>
                      void navigator.clipboard.writeText(issuedKey.apiKey)
                    }
                    variant="outline"
                  >
                    Copy key
                  </Button>
                  <Button disabled={busy} onClick={useIssuedKey}>
                    Use in encrypted vault
                  </Button>
                </div>
              </section>
            )}

            <div className="mt-8 space-y-4">
              {keys.map((key) => (
                <article
                  className="rounded-xl border border-white/10 bg-card p-5"
                  key={key.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <p className="font-mono text-sm">{key.keyPrefix}…</p>
                        {key.isCurrent && (
                          <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2 py-0.5 text-xs text-emerald-200">
                            current
                          </span>
                        )}
                      </div>
                      <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm text-muted-foreground sm:grid-cols-2">
                        <div>
                          <dt>Request quota</dt>
                          <dd className="text-foreground">
                            {key.quotaPerMinute}/minute
                          </dd>
                        </div>
                        <div>
                          <dt>Compute quota</dt>
                          <dd className="text-foreground">
                            {key.computeQuotaDaily}/day
                          </dd>
                        </div>
                        <div>
                          <dt>Created</dt>
                          <dd className="text-foreground">
                            {formatDate(key.createdAt)}
                          </dd>
                        </div>
                        <div>
                          <dt>Last used</dt>
                          <dd className="text-foreground">
                            {formatDate(key.lastUsedAt)}
                          </dd>
                        </div>
                      </dl>
                    </div>
                    <Button
                      disabled={busy || key.isCurrent}
                      onClick={() => void revokeKey(key)}
                      variant="outline"
                    >
                      {key.isCurrent ? "Active key" : "Revoke"}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}
