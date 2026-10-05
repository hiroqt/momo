"""Safety checks shared by database and performance test runners."""

from urllib.parse import urlsplit


def require_loopback_url(value: str, schemes: tuple[str, ...]) -> str:
    parsed = urlsplit(value)
    if parsed.scheme not in schemes or parsed.hostname not in {"127.0.0.1", "::1"}:
        raise ValueError("Tests require an explicit loopback IP; hosted endpoints are forbidden")
    if parsed.query or parsed.fragment:
        raise ValueError("Connection options in URLs are forbidden for local testing")
    return value
