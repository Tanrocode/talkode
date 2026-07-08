"""Judge0 CE code execution for coding challenge test cases.

Judge0 CE is a public code execution API with no auth required.
Base URL configured via JUDGE0_URL env var (default: https://ce.judge0.com).
"""

import json
import logging
import os

import httpx

log = logging.getLogger("test_runner")

JUDGE0_URL = os.environ.get("JUDGE0_URL", "https://ce.judge0.com").rstrip("/")

JUDGE0_LANG_IDS: dict[str, int] = {
    "python":      100,  # Python 3.12.5  (internal id from challenge_picker)
    "javascript":   93,  # Node.js 18.15.0
    "typescript":   94,  # TypeScript 5.0.3
    "java":         91,  # Java JDK 17.0.6
    "cpp":         105,  # C++ GCC 14.1.0
    "csharp":       51,  # C# Mono 6.6.0.161
    "go":          106,  # Go 1.22.0       (internal id from challenge_picker)
    "rust":        108,  # Rust 1.85.0
    "php":          98,  # PHP 8.3.11
    "ruby":         72,  # Ruby 2.7.0
}

# Judge0 status IDs
_STATUS_ACCEPTED = 3
_STATUS_WRONG = 4
_STATUS_TLE = 5
_STATUS_COMPILE_ERROR = 6
_STATUS_RUNTIME_ERROR_SIGSEGV = 11
_STATUS_RUNTIME_ERRORS_START = 7


async def execute(source_code: str, language: str) -> dict:
    """Submit source code to Judge0 and wait for the result."""
    lang_id = JUDGE0_LANG_IDS.get(language)
    if not lang_id:
        return {
            "stdout": None,
            "stderr": f"Unsupported language: {language}",
            "status": {"id": -1, "description": "Unsupported language"},
        }

    payload = {
        "language_id": lang_id,
        "source_code": source_code,
        "stdin": "",
        "cpu_time_limit": 3,
        "memory_limit": 262144,  # 256 MB
    }

    async with httpx.AsyncClient(timeout=20.0) as http:
        resp = await http.post(
            f"{JUDGE0_URL}/submissions",
            json=payload,
            params={"wait": "true"},
            headers={"Content-Type": "application/json"},
        )
        resp.raise_for_status()
        return resp.json()


# Standard library imports prepended BEFORE candidate code per language.
# Harnesses must NOT include these — they belong at the top of the file only.
_PREAMBLES: dict[str, str] = {
    "python": (
        "from typing import List, Dict, Tuple, Set, Optional, Any, Union, Deque\n"
        "from collections import defaultdict, Counter, deque\n"
        "import heapq, math, sys\n"
    ),
    "java": (
        "import java.util.*;\n"
        "import java.util.stream.*;\n"
        "import java.util.function.*;\n"
    ),
    "cpp": (
        "#include <iostream>\n"
        "#include <vector>\n"
        "#include <string>\n"
        "#include <unordered_map>\n"
        "#include <unordered_set>\n"
        "#include <map>\n"
        "#include <set>\n"
        "#include <queue>\n"
        "#include <stack>\n"
        "#include <algorithm>\n"
        "#include <climits>\n"
        "#include <numeric>\n"
        "#include <sstream>\n"
        "using namespace std;\n"
    ),
    "csharp": (
        "using System;\n"
        "using System.Collections.Generic;\n"
        "using System.Linq;\n"
        "using System.Text;\n"
    ),
    "go": (
        "package main\n"
        "import (\n"
        '    "encoding/json"\n'
        '    "fmt"\n'
        '    "math"\n'
        '    "sort"\n'
        '    "strings"\n'
        ")\n"
        "var _ = json.Marshal\n"
        "var _ = fmt.Println\n"
        "var _ = math.Abs\n"
        "var _ = sort.Ints\n"
        "var _ = strings.Join\n"
    ),
    "ruby": "require 'json'\n",
    "rust": (
        "use std::collections::HashMap;\n"
        "use std::collections::HashSet;\n"
        "use std::collections::BTreeMap;\n"
    ),
}


async def run_tests(candidate_code: str, language: str, harness: str) -> list[dict]:
    """Run candidate code + harness through Judge0, parse stdout as JSON test results.

    Returns a list of result dicts:
      {"desc": str, "visible": bool, "passed": bool, "actual": any, "expected": any}
    On execution failure a single failed result is returned describing the error.
    """
    preamble = _PREAMBLES.get(language, "")
    source = preamble + candidate_code.rstrip() + "\n\n" + harness

    try:
        result = await execute(source, language)
    except httpx.HTTPError as exc:
        log.error("Judge0 HTTP error: %s", exc)
        return [_error_result("Judge0 connection failed", str(exc))]
    except Exception as exc:
        log.error("Judge0 unexpected error: %s", exc)
        return [_error_result("Execution error", str(exc))]

    status = result.get("status") or {}
    status_id = status.get("id") if isinstance(status, dict) else None
    stdout = (result.get("stdout") or "").strip()
    stderr = (result.get("stderr") or "").strip()
    compile_output = (result.get("compile_output") or "").strip()

    if status_id == _STATUS_COMPILE_ERROR:
        msg = compile_output or stderr or "Compile error (no output)"
        return [_error_result("Compile error", msg[:400])]

    if status_id == _STATUS_TLE:
        return [_error_result("Time limit exceeded", "Solution took longer than 3 seconds")]

    if status_id is not None and status_id >= _STATUS_RUNTIME_ERRORS_START and status_id != _STATUS_WRONG:
        desc = status.get("description", "Runtime error")
        msg = stderr or f"Status: {desc}"
        return [_error_result(desc, msg[:400])]

    # Try to parse stdout as JSON test results
    if stdout:
        try:
            parsed = json.loads(stdout)
            if isinstance(parsed, list):
                return parsed
        except (json.JSONDecodeError, ValueError):
            pass

    # Unexpected output — surface as error
    error_detail = stderr[:300] if stderr else f"Unexpected output: {stdout[:300]}"
    return [_error_result("Unexpected output", error_detail)]


def _error_result(desc: str, error: str) -> dict:
    return {
        "desc": desc,
        "visible": True,
        "passed": False,
        "actual": None,
        "expected": None,
        "error": error,
    }
