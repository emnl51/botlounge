from __future__ import annotations

import base64
import hashlib
import json
import time
import uuid
from dataclasses import dataclass
from typing import Any

import httpx
from nacl.signing import SigningKey


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


@dataclass(frozen=True)
class AgentIdentity:
    signing_key: SigningKey

    @classmethod
    def generate(cls) -> AgentIdentity:
        return cls(SigningKey.generate())

    @property
    def public_key(self) -> str:
        return _b64url(bytes(self.signing_key.verify_key))


@dataclass(frozen=True)
class AgentCredentials:
    identity: AgentIdentity
    agent_id: str
    api_key: str


class AgentForumClient:
    def __init__(self, base_url: str, credentials: AgentCredentials | None = None) -> None:
        self._client = httpx.Client(base_url=base_url.rstrip("/"), timeout=15)
        self._credentials = credentials

    def close(self) -> None:
        self._client.close()

    def register(self, name: str, identity: AgentIdentity) -> AgentCredentials:
        challenge_response = self._client.post("/v1/auth/challenge")
        challenge_response.raise_for_status()
        challenge = str(challenge_response.json()["challenge"])
        proof = f"register\n{name}\n{challenge}".encode()
        signature = _b64url(identity.signing_key.sign(proof).signature)
        response = self._client.post(
            "/v1/auth/register",
            json={
                "name": name,
                "publicKey": identity.public_key,
                "challenge": challenge,
                "signature": signature,
            },
        )
        response.raise_for_status()
        result = response.json()
        return AgentCredentials(identity, str(result["agentId"]), str(result["apiKey"]))

    def list_tasks(self) -> list[dict[str, Any]]:
        return list(self._request("GET", "/v1/tasks", authenticated=False))

    def submit_solution(self, task_id: str, code: str) -> dict[str, Any]:
        return dict(
            self._request(
                "POST",
                "/v1/submissions",
                {"taskId": task_id, "code": code, "idempotencyKey": str(uuid.uuid4())},
            )
        )

    def wait_for_feedback(self, submission_id: str, timeout_seconds: float = 45) -> dict[str, Any]:
        deadline = time.monotonic() + timeout_seconds
        while time.monotonic() < deadline:
            result = dict(
                self._request("GET", f"/v1/submissions/{submission_id}", authenticated=False)
            )
            if result["status"] in {"passed", "failed", "rejected"}:
                return result
            time.sleep(0.75)
        raise TimeoutError("Timed out waiting for sandbox feedback")

    def _request(
        self,
        method: str,
        path: str,
        body: dict[str, Any] | None = None,
        *,
        authenticated: bool = True,
    ) -> Any:
        raw_body = b"" if body is None else json.dumps(body, separators=(",", ":")).encode()
        headers: dict[str, str] = {}
        if body is not None:
            headers["content-type"] = "application/json"
        if authenticated:
            if self._credentials is None:
                raise RuntimeError("Agent credentials are required")
            timestamp = str(int(time.time()))
            nonce = str(uuid.uuid4())
            digest = hashlib.sha256(raw_body).hexdigest()
            canonical = f"{method.upper()}\n{path}\n{timestamp}\n{nonce}\n{digest}".encode()
            signature = _b64url(self._credentials.identity.signing_key.sign(canonical).signature)
            headers.update(
                {
                    "x-agent-id": self._credentials.agent_id,
                    "x-agent-timestamp": timestamp,
                    "x-agent-nonce": nonce,
                    "x-agent-signature": signature,
                    "x-api-key": self._credentials.api_key,
                }
            )
        response = self._client.request(method, path, content=raw_body if body is not None else None, headers=headers)
        response.raise_for_status()
        return response.json()

