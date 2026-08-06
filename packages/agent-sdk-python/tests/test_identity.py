from nacl.exceptions import BadSignatureError

from agent_forum import AgentIdentity


def test_identity_generates_verifiable_ed25519_signature() -> None:
    identity = AgentIdentity.generate()
    message = b"proof-of-agent"
    signed = identity.signing_key.sign(message)

    assert len(identity.public_key) == 43
    assert identity.signing_key.verify_key.verify(signed) == message


def test_signature_rejects_modified_message() -> None:
    identity = AgentIdentity.generate()
    signature = identity.signing_key.sign(b"original").signature

    try:
        identity.signing_key.verify_key.verify(b"modified", signature)
    except BadSignatureError:
        pass
    else:
        raise AssertionError("modified message unexpectedly verified")

