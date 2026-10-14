"""Evaluate the production Jev auto-accept rule on a small synthetic corpus."""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
os.environ.setdefault("APP_ENV", "local")
os.environ.setdefault("LOCAL_ONLY", "true")
os.environ.setdefault("DATABASE_BACKEND", "memory")
sys.path.insert(0, str(ROOT / "backend"))

from app.services.validation.typesafe_grounding import (  # noqa: E402
    BATCH_SIZE,
    TypeSafeGroundingVerifier,
)

FIXTURE = Path(__file__).resolve().parents[1] / "tests/fixtures/jev_grounding_eval.json"
MAX_CASES = 24
RELATIONS = {"supports", "contradicts", "says_nothing"}


def load_cases(path: Path = FIXTURE) -> list[dict[str, str]]:
    cases = json.loads(path.read_text())
    if not isinstance(cases, list) or not 0 < len(cases) <= MAX_CASES:
        raise ValueError(f"Evaluation set must contain 1 to {MAX_CASES} cases.")
    ids: set[str] = set()
    for case in cases:
        if (
            not isinstance(case, dict)
            or set(case) != {"id", "expected", "evidence", "question", "answer"}
            or not all(isinstance(case[key], str) and case[key] for key in case)
            or case["expected"] not in RELATIONS
            or len(case["evidence"]) > 2_000
            or len(case["question"]) > 1_000
            or len(case["answer"]) > 1_000
            or case["id"] in ids
        ):
            raise ValueError("Evaluation case has invalid fields, size, label, or duplicate ID.")
        ids.add(case["id"])
    return cases


def score_results(
    cases: list[dict[str, str]], answers: dict[str, Any]
) -> dict[str, Any]:
    if set(answers) != {case["id"] for case in cases}:
        raise ValueError("Every evaluation case must have exactly one answer.")
    tp = fp = tn = fn = 0
    for case in cases:
        accepted = TypeSafeGroundingVerifier._supports(answers[case["id"]])
        expected = case["expected"] == "supports"
        if accepted and expected:
            tp += 1
        elif accepted:
            fp += 1
        elif expected:
            fn += 1
        else:
            tn += 1
    return {
        "total": len(cases),
        "auto_accept": {
            "true_positive": tp,
            "false_positive": fp,
            "true_negative": tn,
            "false_negative": fn,
            "false_accept_rate": round(fp / (fp + tn), 4) if fp + tn else None,
            "false_reject_rate": round(fn / (fn + tp), 4) if fn + tp else None,
        },
    }


def request_payload(cases: list[dict[str, str]]) -> dict[str, Any]:
    if not 0 < len(cases) <= BATCH_SIZE:
        raise ValueError(f"Each TypeSafe request must contain 1 to {BATCH_SIZE} cases.")
    entries = []
    for case in cases:
        candidate = {"question": case["question"], "answer": case["answer"]}
        item = {**candidate, "source_metadata": {"chunk_id": case["id"]}}
        entries.append((item, {"candidate": candidate, "evidence": case["evidence"]}))
    return TypeSafeGroundingVerifier()._request_payload(entries)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--live", action="store_true", help="Make the bounded synthetic evaluation (two requests for the current 18-case set).")
    parser.add_argument("--output", type=Path, help="Write the answer and metrics JSON to this path.")
    args = parser.parse_args()
    cases = load_cases()
    if not args.live:
        print(json.dumps({"cases": len(cases), "labels": sorted({case["expected"] for case in cases}), "live_call": "not made; pass --live to run"}, indent=2))
        return 0

    answers: dict[str, Any] = {}
    models: set[str] = set()
    usage = {"input_tokens": 0, "output_tokens": 0}
    for start in range(0, len(cases), BATCH_SIZE):
        batch = cases[start : start + BATCH_SIZE]
        completed = subprocess.run(
            [sys.executable, str(ROOT / "scripts/jev_judge.py")],
            input=json.dumps(request_payload(batch), ensure_ascii=False),
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
        if completed.returncode:
            print(completed.stderr.strip() or "Jev evaluation failed.", file=sys.stderr)
            return 1
        result = json.loads(completed.stdout)
        models.add(result.get("model", "unknown"))
        for key in usage:
            usage[key] += result["usage"][key]
        for index, case in enumerate(batch):
            answers[case["id"]] = result["answers"][f"item_{index}"]
    report = {
        "models": sorted(models),
        "usage": usage,
        "metrics": score_results(cases, answers),
        "answers": answers,
    }
    encoded = json.dumps(report, indent=2, ensure_ascii=False)
    if args.output:
        args.output.write_text(encoded + "\n")
    print(encoded)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
