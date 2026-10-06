"""Fail CI when a JUnit report shows skipped, errored or missing tests.

Usage: python scripts/testing/assert_no_skips.py backend-junit.xml [min_tests]
Real PostgreSQL integration must run in CI; a silent skip is a failure.
"""

import sys
import xml.etree.ElementTree as ET


def main(path: str, minimum: int = 1) -> int:
    root = ET.parse(path).getroot()
    suites = [root] if root.tag == "testsuite" else list(root.iter("testsuite"))
    totals = {key: sum(int(s.get(key, 0)) for s in suites) for key in ("tests", "skipped", "errors", "failures")}
    skipped = [f"{case.get('classname')}::{case.get('name')}" for case in root.iter("testcase")
               if case.find("skipped") is not None]
    print(totals)
    if skipped:
        print("Skipped tests are not allowed in CI:\n  " + "\n  ".join(skipped[:50]))
    if totals["skipped"] or totals["errors"] or totals["failures"] or totals["tests"] < minimum:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 1))
