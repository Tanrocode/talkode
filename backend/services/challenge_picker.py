import json
import os
import random
import re

# Trimmed LeetCode dataset bundled with the repo (backend/data/) — only the
# Easy/Medium problems that have a reference solution, and only the fields
# we actually use. Set LEETCODE_DATASET_PATH to point at the full raw
# merged_problems.json instead (e.g. for local dev against the whole set).
_DEFAULT_DATASET_PATH = os.path.join(
    os.path.dirname(__file__), "..", "data", "leetcode_problems.json"
)
_DATASET_PATH = os.environ.get("LEETCODE_DATASET_PATH", _DEFAULT_DATASET_PATH)

_cache: list[dict] | None = None


def _load() -> list[dict]:
    global _cache
    if _cache is None:
        try:
            with open(_DATASET_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            _cache = data.get("questions", [])
        except Exception as e:
            print(f"[challenge_picker] failed to load dataset at {_DATASET_PATH}: {e}")
            _cache = []
    return _cache


# Topics that map naturally onto "this helps the system run faster" framing —
# weighted by how good a fit they are for a short mid-interview detour.
TOPIC_WEIGHTS = {
    "Hash Table": 3,
    "Design": 3,
    "Heap (Priority Queue)": 2,
    "Sliding Window": 2,
    "Two Pointers": 2,
    "Binary Search": 2,
    "Queue": 2,
    "Stack": 1,
    "Linked List": 1,
    "Trie": 1,
    "Greedy": 1,
    "Sorting": 1,
    "Array": 1,
    "String": 1,
    "Counting": 1,
}

DIFFICULTY_WEIGHTS = {"Easy": 2, "Medium": 3, "Hard": -3}

DEFAULT_FRAMING = "Here's a problem that exercises a core data structure concept — implement it below."

# Dataset language key -> {our internal id, display label}. Only languages we
# can actually syntax-highlight client-side are exposed in the picker.
SUPPORTED_LANGUAGES = {
    "python3": {"id": "python", "label": "Python"},
    "javascript": {"id": "javascript", "label": "JavaScript"},
    "typescript": {"id": "typescript", "label": "TypeScript"},
    "java": {"id": "java", "label": "Java"},
    "cpp": {"id": "cpp", "label": "C++"},
    "csharp": {"id": "csharp", "label": "C#"},
    "golang": {"id": "go", "label": "Go"},
    "rust": {"id": "rust", "label": "Rust"},
    "php": {"id": "php", "label": "PHP"},
    "ruby": {"id": "ruby", "label": "Ruby"},
}

DEFAULT_LANGUAGE = "python"


# In the raw dataset, "description" sometimes ends with dangling section
# headers ("Example 1:", "Constraints:") that have no text after them — the
# real content lives in the separate examples/constraints fields, which we
# render verbatim, unmodified, in their own section below. This only strips
# those empty trailing headers from the description; it never touches the
# actual example or constraint content.
_TRAILING_HEADER_RE = re.compile(r"\n?(Example \d+:|Constraints:|Follow-up:)\s*$")


def _clean_description(description: str) -> str:
    text = description
    while True:
        stripped = _TRAILING_HEADER_RE.sub("", text).rstrip()
        if stripped == text:
            return stripped
        text = stripped


# For "Design"-style problems (e.g. "Implement a SnapshotArray that supports
# the following interface:"), the dataset's scrape sometimes lost the bullet
# list of method signatures that should follow — the description just trails
# off. Rather than show a cut-off sentence, derive the same interface from the
# (also unmodified) starter code, which always has the real method names,
# params, and return types since the candidate has to implement them anyway.
_DANGLING_INTERFACE_RE = re.compile(r"(?:interface|methods?|class)\s*:\s*$", re.IGNORECASE)
_CLASS_RE = re.compile(r"class\s+(\w+)")
_DEF_RE = re.compile(r"def\s+(\w+)\(self(?:,\s*(.*?))?\)\s*(?:->\s*([\w\[\], .]+))?\s*:")


def _derive_interface(starter_code: str) -> list[str] | None:
    class_match = _CLASS_RE.search(starter_code)
    if not class_match:
        return None
    class_name = class_match.group(1)

    def param_names(raw: str | None) -> list[str]:
        if not raw:
            return []
        return [p.strip().split(":")[0].strip() for p in raw.split(",") if p.strip()]

    lines: list[str] = []
    for m in _DEF_RE.finditer(starter_code):
        name, raw_params, ret = m.group(1), m.group(2), (m.group(3) or "").strip()
        params = param_names(raw_params)
        if name == "__init__":
            lines.append(f"{class_name}({', '.join(params)})")
        elif not name.startswith("_"):
            ret_label = f" -> {ret}" if ret and ret != "None" else ""
            lines.append(f"{name}({', '.join(params)}){ret_label}")
    return lines or None


def _enrich_description(description: str, starter_code: str) -> str:
    if not _DANGLING_INTERFACE_RE.search(description):
        return description
    interface = _derive_interface(starter_code)
    if not interface:
        return description
    bullet_list = "\n".join(f"- {line}" for line in interface)
    return f"{description}\n{bullet_list}"


def _score(problem: dict) -> float:
    topics = problem.get("topics") or []
    score = sum(TOPIC_WEIGHTS.get(t, 0) for t in topics)
    score += DIFFICULTY_WEIGHTS.get(problem.get("difficulty"), 0)
    return score


def _framing_for(problem: dict) -> str:
    return DEFAULT_FRAMING


def _build_challenge(problem: dict) -> dict:
    raw_snippets = problem.get("code_snippets") or {}
    starter_by_language = {
        meta["id"]: raw_snippets[lc_key]
        for lc_key, meta in SUPPORTED_LANGUAGES.items()
        if raw_snippets.get(lc_key)
    }

    description = _clean_description(problem.get("description", ""))
    description = _enrich_description(description, raw_snippets.get("python3", ""))

    return {
        "frontend_id": problem.get("frontend_id"),
        "title": problem.get("title"),
        "difficulty": problem.get("difficulty"),
        "topics": problem.get("topics") or [],
        "intro": _framing_for(problem),
        "description": description,
        "examples": problem.get("examples") or [],
        "constraints": problem.get("constraints") or [],
        "starter_code": starter_by_language,
        "default_language": DEFAULT_LANGUAGE if DEFAULT_LANGUAGE in starter_by_language else next(iter(starter_by_language), "python"),
        # Reference editorial — multiple approaches + complexity analysis.
        # Never sent to the candidate; only surfaced on the recruiter report.
        "solution": problem.get("solution", ""),
    }


def pick_challenge_pool(session_id: str, pool_size: int = 10) -> list[dict]:
    """Rank candidates by topic/difficulty fit, then return several distinct,
    fully-built challenges (in a session-seeded but shuffled order) so the
    caller can run a relevance + completeness check on each and skip any
    that don't fit or look broken, without re-deriving the ranking each time.

    Restricted to problems that actually have a reference editorial
    ("solution") in the dataset — recruiters need that to judge submissions
    against, and roughly 660 of the ~2,200 Easy/Medium problems have one.
    The ranked pool is intentionally wide (not just a static top-25) so
    different sessions can land on genuinely different, still-relevant,
    problems instead of all drawing from the same narrow shortlist.
    """
    problems = _load()
    if not problems:
        return []

    candidates = [
        p
        for p in problems
        if p.get("difficulty") in ("Easy", "Medium") and (p.get("solution") or "").strip()
    ]
    if not candidates:
        return []

    scored = sorted(candidates, key=_score, reverse=True)
    top = scored[:120] if len(scored) >= 120 else scored

    rng = random.Random(session_id)
    shuffled = top[:]
    rng.shuffle(shuffled)

    return [_build_challenge(p) for p in shuffled[:pool_size]]


def pick_challenge(session_id: str) -> dict | None:
    """Single-candidate convenience wrapper (no sanity-checking) — kept for
    any direct/simple callers. Prefer pick_challenge_pool when validating.
    """
    pool = pick_challenge_pool(session_id, pool_size=1)
    return pool[0] if pool else None
