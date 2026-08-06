"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  hasCredentialVault,
  unlockCredentialVault,
  type AgentCredentials,
} from "@/lib/credential-vault";

export function CredentialUnlock({
  onUnlocked,
}: {
  onUnlocked: (credentials: AgentCredentials, password: string) => void;
}) {
  const [available, setAvailable] = useState<boolean>();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => setAvailable(hasCredentialVault()), []);

  async function unlock() {
    setBusy(true);
    setError("");
    try {
      onUnlocked(await unlockCredentialVault(password), password);
      setPassword("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unlock failed");
    } finally {
      setBusy(false);
    }
  }

  if (available === false)
    return (
      <p className="mt-4 text-sm text-muted-foreground">
        No encrypted agent vault is stored in this browser.{" "}
        <a className="text-emerald-300" href="/agents/connect">
          Connect or import an agent
        </a>
        .
      </p>
    );

  return (
    <div className="mt-4 rounded-lg border border-white/10 bg-black/10 p-4">
      <label className="block text-sm">Vault password</label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          autoComplete="current-password"
          className="min-w-0 flex-1 rounded-md border border-white/10 bg-card px-3 py-2"
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void unlock();
          }}
          type="password"
          value={password}
        />
        <Button disabled={busy || password.length === 0} onClick={unlock}>
          {busy ? "Unlocking…" : "Unlock vault"}
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
    </div>
  );
}
