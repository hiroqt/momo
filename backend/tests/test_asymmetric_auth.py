"""Real asymmetric signatures with mocked JWKS transport; no hosted auth traffic."""
import time
from types import SimpleNamespace
from uuid import uuid4

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec, rsa
from fastapi import HTTPException

from app import dependencies
from app.config import settings


@pytest.mark.parametrize("algorithm", ["RS256", "ES256"])
async def test_asymmetric_tokens_use_pinned_jwks_and_verify_signature(monkeypatch, algorithm):
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048) if algorithm == "RS256" else ec.generate_private_key(ec.SECP256R1())
    other = rsa.generate_private_key(public_exponent=65537, key_size=2048) if algorithm == "RS256" else ec.generate_private_key(ec.SECP256R1())
    issuer = "https://example.supabase.co/auth/v1"
    monkeypatch.setattr(settings, "SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setattr(settings, "ENABLE_DEV_AUTH", False)
    requested = []
    class Keys:
        def get_signing_key_from_jwt(self, value):
            return SimpleNamespace(key=private.public_key())
    def client(url):
        requested.append(url)
        return Keys()
    monkeypatch.setattr(dependencies, "_jwks_client", client)
    subject = str(uuid4())
    payload = {"sub": subject, "exp": int(time.time()) + 60, "iat": int(time.time()),
               "iss": issuer, "aud": "authenticated", "role": "authenticated", "is_anonymous": False,
               "app_metadata": {"provider": "google", "providers": ["google"]},
               "amr": [{"method": "oauth"}]}
    # Attacker-controlled jku must never redirect the key fetch.
    headers = {"kid": "local-key", "jku": "https://untrusted.invalid/keys"}
    valid = jwt.encode(payload, private, algorithm=algorithm, headers=headers)
    assert (await dependencies.get_current_user("Bearer " + valid)).id == subject
    forged = jwt.encode(payload, other, algorithm=algorithm, headers=headers)
    with pytest.raises(HTTPException) as denied:
        await dependencies.get_current_user("Bearer " + forged)
    assert denied.value.status_code == 401
    assert requested == [issuer + "/.well-known/jwks.json"] * 2


@pytest.mark.parametrize("algorithm", ["RS256", "ES256"])
@pytest.mark.parametrize("invalid_claim", [
    "wrong_issuer", "wrong_audience", "expired", "future_issued_at", "invalid_subject",
    "wrong_role", "anonymous", "non_google_provider", "mixed_providers", "password_auth", "user_metadata_spoof",
])
async def test_asymmetric_google_tokens_reject_invalid_signed_claims(monkeypatch, algorithm, invalid_claim):
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048) if algorithm == "RS256" else ec.generate_private_key(ec.SECP256R1())
    issuer = "https://example.supabase.co/auth/v1"
    monkeypatch.setattr(settings, "SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setattr(settings, "SUPABASE_JWT_AUDIENCE", "authenticated")
    monkeypatch.setattr(settings, "ENABLE_DEV_AUTH", False)

    class Keys:
        def get_signing_key_from_jwt(self, token):
            return SimpleNamespace(key=private.public_key())

    monkeypatch.setattr(dependencies, "_jwks_client", lambda url: Keys())
    now = int(time.time())
    payload = {
        "sub": str(uuid4()), "exp": now + 60, "iat": now,
        "iss": issuer, "aud": "authenticated", "role": "authenticated", "is_anonymous": False,
        "app_metadata": {"provider": "google", "providers": ["google"]},
        "amr": [{"method": "oauth"}],
    }
    invalid_values = {
        "wrong_issuer": {"iss": issuer + "/attacker"},
        "wrong_audience": {"aud": "anon"},
        "expired": {"exp": now - 1},
        "future_issued_at": {"iat": now + 60},
        "invalid_subject": {"sub": "not-a-uuid"},
        "wrong_role": {"role": "anon"},
        "anonymous": {"is_anonymous": True},
        "non_google_provider": {"app_metadata": {"provider": "github", "providers": ["github"]}},
        "mixed_providers": {"app_metadata": {"provider": "google", "providers": ["google", "email"]}},
        "password_auth": {"amr": [{"method": "password"}]},
        "user_metadata_spoof": {
            "app_metadata": {}, "user_metadata": {"provider": "google", "providers": ["google"]},
        },
    }
    payload.update(invalid_values[invalid_claim])
    token = jwt.encode(payload, private, algorithm=algorithm)

    with pytest.raises(HTTPException) as denied:
        await dependencies.get_current_user("Bearer " + token)
    assert denied.value.status_code == 401


@pytest.mark.parametrize("algorithm", ["RS256", "ES256"])
@pytest.mark.parametrize("missing_claim", ["sub", "exp", "iat", "aud", "iss"])
async def test_asymmetric_google_tokens_require_registered_claims(monkeypatch, algorithm, missing_claim):
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048) if algorithm == "RS256" else ec.generate_private_key(ec.SECP256R1())
    issuer = "https://example.supabase.co/auth/v1"
    monkeypatch.setattr(settings, "SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setattr(settings, "SUPABASE_JWT_AUDIENCE", "authenticated")
    monkeypatch.setattr(settings, "ENABLE_DEV_AUTH", False)

    class Keys:
        def get_signing_key_from_jwt(self, token):
            return SimpleNamespace(key=private.public_key())

    monkeypatch.setattr(dependencies, "_jwks_client", lambda url: Keys())
    now = int(time.time())
    payload = {
        "sub": str(uuid4()), "exp": now + 60, "iat": now,
        "iss": issuer, "aud": "authenticated", "role": "authenticated", "is_anonymous": False,
        "app_metadata": {"provider": "google", "providers": ["google"]},
        "amr": [{"method": "oauth"}],
    }
    del payload[missing_claim]
    token = jwt.encode(payload, private, algorithm=algorithm)

    with pytest.raises(HTTPException) as denied:
        await dependencies.get_current_user("Bearer " + token)
    assert denied.value.status_code == 401


async def test_jwks_outage_fails_closed_without_exposing_details(monkeypatch):
    monkeypatch.setattr(settings, "ENABLE_DEV_AUTH", False)
    class Keys:
        def get_signing_key_from_jwt(self, value):
            raise jwt.PyJWKClientConnectionError("private endpoint details")
    monkeypatch.setattr(dependencies, "_jwks_client", lambda url: Keys())
    private = ec.generate_private_key(ec.SECP256R1())
    token = jwt.encode({"sub": str(uuid4())}, private, algorithm="ES256")
    with pytest.raises(HTTPException) as denied:
        await dependencies.get_current_user("Bearer " + token)
    assert denied.value.status_code == 401
    assert "private" not in str(denied.value.detail)
