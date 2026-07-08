"""LLM-generated test harness scripts for coding challenges.

Harnesses are complete, self-contained code snippets that, when appended to
a candidate's solution, output a JSON array of test results to stdout. They
are generated once per (problem, language) pair and cached in Redis with no
TTL — problems never change, so there's no reason to expire them.
"""

import json
import logging

from openai import AsyncOpenAI
import os

client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))
log = logging.getLogger("test_generator")

SUPPORTED_LANGUAGES = [
    "python", "javascript", "typescript", "java", "cpp",
    "csharp", "go", "rust", "php", "ruby",
]

_LANG_NOTES = {
    "python": (
        "Python 3. The candidate's code defines a class `Solution`. "
        "Instantiate it with `_s = Solution()` and call instance methods. "
        "Use `import json as _json` for JSON output."
    ),
    "javascript": (
        "Node.js (CommonJS). The candidate's code defines a function or class at the top level. "
        "Call the function directly (or instantiate the class). "
        "Use `process.stdout.write(JSON.stringify(results) + '\\n')` for output. "
        "Do NOT add `import` or `require()` calls — all Node.js builtins (JSON, process, console) "
        "are available without imports."
    ),
    "typescript": (
        "TypeScript compiled to Node.js. Treat identically to JavaScript. "
        "Do NOT add `import` or `require()` calls. "
        "Do NOT add any TypeScript type annotations in the harness — write plain JavaScript "
        "that ts-node happens to accept."
    ),
    "java": (
        "Java. The file is compiled as Main.java. The candidate's code defines a class `Solution`. "
        "Add exactly: `class Main { public static void main(String[] args) { ... } }` — "
        "the main class MUST be named `Main` (not Runner, not public class anything else). "
        "Instantiate Solution, run tests, print a JSON array via System.out.println. "
        "Build the JSON string manually using StringBuilder. "
        "Do NOT add any import statements — they are already at the top of the file. "
        "Keep the entire harness under 60 lines. StringBuilder appends must each be ≤ 80 chars per line."
    ),
    "cpp": (
        "C++17. The candidate's code defines a class `Solution`. "
        "Add a `int main()` function below that instantiates `Solution`, runs tests, "
        "and prints a JSON array. Build JSON output via explicit `std::string` concatenation. "
        "Do NOT add any #include or using statements — they are already at the top of the file. "
        "CRITICAL: NEVER use `auto` as a return type for any function or lambda — always declare "
        "the return type explicitly (e.g., `std::string safe(const std::string& v)`). "
        "NEVER mix `const char*` string literals with `std::string` variables in the same expression "
        "— use `std::string{\"literal\"}` for any string literal that appears next to a `std::string`."
    ),
    "csharp": (
        "C# (.NET). The candidate's code defines a class `Solution`. "
        "Add a `public class Runner { public static void Main() { ... } }` class below that "
        "instantiates `Solution`, runs tests, and prints JSON via `Console.WriteLine`. "
        "Build the JSON string manually. Do NOT add any using statements — they are already at the top. "
        "NEVER use C# string interpolation (`$\"...\"`) for JSON output — curly braces inside JSON "
        "conflict with the interpolation syntax and cause CS1003 errors. "
        "Use plain string concatenation (`+`) or `string.Format(\"{0}\", val)` instead."
    ),
    "go": (
        "Go. The candidate's code defines solution functions (no package declaration). "
        "Add a `func main()` that calls the solution functions, builds a JSON array, "
        "and prints it. Use `fmt.Println` for output. "
        "Do NOT add package or import statements — they are already at the top of the file. "
        "Prefer building JSON strings manually with `fmt.Sprintf` rather than using `json.Marshal` "
        "on complex or candidate-defined types — unexported fields may not marshal correctly."
    ),
    "rust": (
        "Rust. The candidate's code defines a `struct Solution` and `impl Solution`. "
        "Add a `fn main()` that instantiates `Solution`, runs tests, and prints JSON. "
        "`serde_json` is NOT available — build the JSON string manually. "
        "You MAY add `use` statements for standard library items you need (e.g., `use std::collections::HashMap;`). "
        "Use `String::from(\"text\")` — never bare `\"text\"` where a `String` type is expected. "
        "Use `format!()` for string concatenation — the `+` operator moves ownership and causes borrow errors. "
        "Use `i64` for all integer results to avoid overflow."
    ),
    "php": (
        "PHP 8. The candidate's code defines a class `Solution`. "
        "Append PHP code that instantiates `Solution`, runs tests, and echoes a JSON array "
        "via `echo json_encode($results);`. "
        "Add `error_reporting(0);` as the FIRST statement in the harness to prevent PHP warnings "
        "and notices from corrupting stdout JSON."
    ),
    "ruby": (
        "Ruby. The candidate's code defines a class `Solution`. "
        "Append Ruby code that instantiates `Solution`, runs tests, and prints JSON "
        "via `puts JSON.generate(results)`. Do NOT add `require 'json'` — it is already "
        "prepended before the candidate's code."
    ),
}

_PYTHON_EXAMPLE = '''\
try:
    from typing import *
except Exception:
    pass
import json as _json

_results = []

def _safe(v):
    try:
        _json.dumps(v)
        return v
    except (TypeError, ValueError):
        return str(v)

def _check(desc, visible, actual, expected):
    try:
        a = sorted(actual) if isinstance(actual, list) else actual
        e = sorted(expected) if isinstance(expected, list) else expected
        passed = _json.dumps(a, sort_keys=True, default=str) == _json.dumps(e, sort_keys=True, default=str)
    except Exception:
        passed = actual == expected
    _results.append({"desc": desc, "visible": visible, "passed": passed,
                      "actual": _safe(actual), "expected": _safe(expected)})

try:
    _s = Solution()
    _check("Example 1: [2,7,11,15] target=9", True,  sorted(_s.twoSum([2,7,11,15], 9)),  [0,1])
    _check("Example 2: [3,2,4] target=6",     True,  sorted(_s.twoSum([3,2,4], 6)),      [1,2])
    _check("Example 3: [3,3] target=6",        True,  sorted(_s.twoSum([3,3], 6)),        [0,1])
    _check("Edge: negatives [-1,-2,-3] sum=-5", False, sorted(_s.twoSum([-1,-2,-3], -5)), [1,2])
    _check("Edge: zeros [0,4,3,0] sum=0",       False, sorted(_s.twoSum([0,4,3,0], 0)),   [0,3])
except Exception as _e:
    _results.append({"desc": "Runtime error", "visible": True, "passed": False,
                      "actual": None, "expected": None, "error": str(_e)})

try:
    print(_json.dumps(_results))
except Exception as _fe:
    print(\'[{"desc":"Serialization error","visible":true,"passed":false,"actual":null,"expected":null,"error":"\' + str(_fe).replace(\'"\', "\'") + \'"}]\')
'''


def _build_prompt(problem: dict, language: str) -> str:
    examples_text = "\n".join(
        e.get("example_text", "") for e in (problem.get("examples") or [])
    )
    constraints_text = "\n".join(problem.get("constraints") or [])
    starter = (problem.get("starter_code") or {}).get(language, "")
    lang_note = _LANG_NOTES.get(language, f"Language: {language}")

    return f"""You are generating a self-contained test runner for a coding problem.
The test runner will be APPENDED to the candidate's solution code, compiled/interpreted as a single file,
and must output a JSON array to stdout.

Language: {language}
Language-specific notes: {lang_note}

Problem title: {problem.get("title")}
Problem description:
{problem.get("description", "")}

Examples (EXACT expected outputs — you MUST use these; never invent expected values for visible tests):
{examples_text or "(no examples provided)"}

Constraints:
{constraints_text or "(none)"}

Starter code (shows the function/method signature you must call):
{starter or "(not provided — infer from description)"}

---

TASK: Write ONLY the test runner code (no markdown, no fences, no explanation).

The runner must:
1. Include 1 visible test per example in the problem (marked visible=true). Use the EXACT expected output from the examples above.
2. Include 4-6 hidden edge-case tests (marked visible=false). These cover: empty inputs, single element, all same values, negatives, large values, performance edge cases.
3. Each test call must be wrapped in try/except (or try/catch) so one failure does not abort all tests.
4. Output a single JSON array to stdout. Each element must have: desc (string), visible (bool), passed (bool), actual (any), expected (any). Optionally: error (string).
5. For order-independent results (like indices), sort before comparing.
6. CRITICAL — DO NOT include any import/include/using/require statements in the harness. Standard library imports are already prepended before the candidate's code by the test runner. Adding imports again will cause compile errors (Java: "class expected", C++: duplicate headers, etc.).
7. CRITICAL: The entire harness must exit with code 0 no matter what.
   - For Python: wrap the final `print` in its own try/except; use `default=str` in json.dumps.
   - For Java/C++/C#: wrap ALL test calls in one outer try/catch and print whatever you have so far on error. Keep the catch block to 1 simple line — never put a long JSON string literal in a catch clause (it will break if truncated).
   - The fallback output should be SHORT: e.g. `System.out.println("[]");` or `cout << "[]";` — not a full JSON error object.
8. Keep the harness as concise as possible. Avoid long helper comments or repeated boilerplate. Every token counts.
9. CRITICAL: Keep the entire harness under 65 lines total. If the problem has many examples, use only the first 3 visible tests and at most 4 hidden tests. Truncated harnesses cause compile errors.

Here is a complete Python example for Two Sum to illustrate the required output format and structure:
{_PYTHON_EXAMPLE}

Now write the equivalent runner for the problem above in {language}. Output ONLY the code — no prose, no fences."""


async def _generate_harness(problem: dict, language: str) -> str:
    prompt = _build_prompt(problem, language)
    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
        max_tokens=1400,
    )
    raw = response.choices[0].message.content or ""
    # Strip accidental markdown fences if the model adds them
    if raw.startswith("```"):
        lines = raw.split("\n")
        raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    return raw.strip()


async def get_or_generate_harness(
    frontend_id: str, problem: dict, language: str, r
) -> str | None:
    """Return cached harness from Redis, or generate and cache it.

    Returns None only if generation itself raises an exception.
    """
    key = f"challenge:{frontend_id}:harness:{language}"
    cached = await r.get(key)
    if cached:
        return cached

    try:
        harness = await _generate_harness(problem, language)
        await r.set(key, harness)
        log.info("Generated harness for %s/%s (%d chars)", frontend_id, language, len(harness))
        return harness
    except Exception as exc:
        log.error("Harness generation failed for %s/%s: %s", frontend_id, language, exc)
        return None
