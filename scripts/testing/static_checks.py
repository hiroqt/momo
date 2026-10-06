"""Run the enforced backend Ruff and mypy checks (CI-01).

Run from backend/: `uv run python ../scripts/testing/static_checks.py`.
Every Python file under app/, tests/ and scripts/testing is checked except the
legacy entries in static_check_exclusions.txt. Stale exclusions (files that
no longer exist) fail the run so the ratchet only shrinks.
"""

import re
import subprocess
import sys
from pathlib import Path

RUFF = "ruff@0.16.10"
MYPY = "mypy==2.4.0"
HERE = Path(__file__).resolve().parent


def exclusions() -> dict[str, list[str]]:
    sections: dict[str, list[str]] = {"ruff": [], "mypy": []}
    current = None
    for raw in (HERE / "static_check_exclusions.txt").read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("[") and line.endswith("]"):
            current = line[1:-1]
            continue
        if current not in sections:
            raise SystemExit(f"Unknown exclusion section for {line}")
        sections[current].append(line)
    return sections


def main() -> int:
    backend = Path.cwd()
    if not (backend / "app").is_dir():
        raise SystemExit("Run from backend/")
    excluded = exclusions()
    missing = [p for paths in excluded.values() for p in paths if not (backend / p).is_file()]
    if missing:
        print("Stale static-check exclusions (remove them):", *missing, sep="\n  ")
        return 1
    files = sorted(str(p.relative_to(backend)) for root in ("app", "tests") for p in (backend / root).rglob("*.py"))
    scripts = sorted(str(p) for p in HERE.glob("*.py"))
    ruff_targets = [f for f in files if f not in set(excluded["ruff"])] + scripts
    ruff = subprocess.run(["uvx", RUFF, "check", *ruff_targets], check=False)
    pattern = "|".join(re.escape(p) + "$" for p in excluded["mypy"]) or "^$"
    mypy = subprocess.run(["uv", "run", "--locked", "--with", MYPY, "mypy", "--check-untyped-defs",
                           "--follow-imports", "skip", "--ignore-missing-imports", "--explicit-package-bases",
                           "--exclude", pattern, "app"], check=False)
    print(f"ruff files={len(ruff_targets)} excluded={len(excluded['ruff'])}; "
          f"mypy excluded={len(excluded['mypy'])}")
    return 1 if ruff.returncode or mypy.returncode else 0


if __name__ == "__main__":
    sys.exit(main())
