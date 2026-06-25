import json
import os
import random
import re

# Local LeetCode dataset (title/topics/difficulty/description/examples/constraints/
# starter code per problem). Not part of the repo — point this at wherever the
# dataset lives on the machine running the backend.
_DATASET_PATH = os.environ.get(
    "LEETCODE_DATASET_PATH",
    "/Users/rishit/Downloads/leetcode-problems-master/merged_problems.json",
)

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

# One-line framing per topic, prepended to the (untouched) original description
# so the problem reads like it matters to this platform without changing any
# test data, examples, or constraints.
TOPIC_FRAMING = {
    "Hash Table": "Our session store does a lot of key lookups under the hood — implement the structure that keeps those fast.",
    "Design": "We're prototyping a small piece of internal infrastructure for this platform — implement it below.",
    "Heap (Priority Queue)": "The backend needs to track pending work without re-sorting everything each time it changes — implement the structure that makes that efficient.",
    "Sliding Window": "Our live transcript buffer streams in chunks and needs a tight window over recent activity — implement the algorithm that maintains that efficiently.",
    "Two Pointers": "We need a fast, low-memory pass over ordered session data — implement the approach below.",
    "Binary Search": "We need to search a large, sorted log of interview events quickly — implement the lookup below.",
    "Queue": "Audio chunks sometimes arrive faster than they're processed — we need a structure that handles that backlog efficiently. Implement it below.",
    "Stack": "We need to track nested state cleanly and efficiently as events come in — implement the structure below.",
    "Linked List": "Part of our pipeline needs fast insertion and removal without shifting everything else around — implement it below.",
    "Trie": "We're matching candidate input against a large set of known terms efficiently — implement the structure below.",
    "Sorting": "We need to rank a batch of results efficiently before showing them to a recruiter — implement the approach below.",
}

DEFAULT_FRAMING = "This one's about squeezing more efficiency out of a system at scale — implement it below."

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


def _score(problem: dict) -> float:
    topics = problem.get("topics") or []
    score = sum(TOPIC_WEIGHTS.get(t, 0) for t in topics)
    score += DIFFICULTY_WEIGHTS.get(problem.get("difficulty"), 0)
    return score


def _framing_for(problem: dict) -> str:
    topics = problem.get("topics") or []
    best_topic = max(topics, key=lambda t: TOPIC_WEIGHTS.get(t, 0), default=None)
    return TOPIC_FRAMING.get(best_topic, DEFAULT_FRAMING)


def pick_challenge(session_id: str) -> dict | None:
    """Pick a small, lightly-reskinned LeetCode problem for a mid-interview detour.

    Ranks by topic + difficulty fit for a short "this helps system efficiency"
    framing, then deterministically picks among the top matches (seeded by
    session_id so it's stable per-session but varies across candidates).
    Examples/constraints/starter code are passed through completely untouched —
    only a one-line intro is added on top.
    """
    problems = _load()
    if not problems:
        return None

    candidates = [p for p in problems if p.get("difficulty") in ("Easy", "Medium")]
    if not candidates:
        return None

    scored = sorted(candidates, key=_score, reverse=True)
    top = scored[:25] if len(scored) >= 25 else scored

    rng = random.Random(session_id)
    problem = rng.choice(top)

    raw_snippets = problem.get("code_snippets") or {}
    starter_by_language = {
        meta["id"]: raw_snippets[lc_key]
        for lc_key, meta in SUPPORTED_LANGUAGES.items()
        if raw_snippets.get(lc_key)
    }

    return {
        "frontend_id": problem.get("frontend_id"),
        "title": problem.get("title"),
        "difficulty": problem.get("difficulty"),
        "topics": problem.get("topics") or [],
        "intro": _framing_for(problem),
        "description": _clean_description(problem.get("description", "")),
        "examples": problem.get("examples") or [],
        "constraints": problem.get("constraints") or [],
        "starter_code": starter_by_language,
        "default_language": DEFAULT_LANGUAGE if DEFAULT_LANGUAGE in starter_by_language else next(iter(starter_by_language), "python"),
    }
