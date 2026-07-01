import asyncio
import json
import os

import httpx
from openai import AsyncOpenAI

MODEL = "gpt-4o"

# Never use TTC compression here — the TTC wrapper uses a sync HTTP transport
# internally, which blocks the event loop when asyncio.gather fires multiple
# file-generation calls in parallel and causes 30-second read timeouts.
client = AsyncOpenAI(
    api_key=os.environ.get("OPENAI_API_KEY", ""),
    timeout=httpx.Timeout(120.0, connect=10.0),
)

# Limit concurrent file-generation calls to avoid exhausting the connection pool.
_FILE_GEN_SEM = asyncio.Semaphore(4)


async def _json_call(prompt: str, temperature: float = 0) -> dict:
    response = await client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        temperature=temperature,
    )
    return json.loads(response.choices[0].message.content)


# ---------------------------------------------------------------------------
# Step 1 — Extract inferred signals from the job description
# ---------------------------------------------------------------------------

async def extract_jd_brief(jd_text: str) -> dict:
    if not jd_text.strip():
        return {}

    return await _json_call(f"""You are extracting signal from a job description to inform technical interview codebase generation.

Job Description:
{jd_text}

Extract the following. Use null for anything you cannot determine from the JD.

Return JSON with exactly these keys:
{{
  "role_level": "intern" | "junior" | "mid" | "senior" | "staff",
  "domain": short string — the business domain (e.g. "logistics", "fintech", "HR tooling", "developer tools"),
  "implied_stack": list of specific technologies inferred (e.g. ["React", "Python", "PostgreSQL"]),
  "soft_skill_emphasis": list of skills the JD stresses (e.g. ["code clarity", "product thinking", "debugging"]),
  "assessment_tone": "exploratory" (candidate explains and reasons) or "rigorous" (candidate finds specific bugs and fixes)
}}""")


# ---------------------------------------------------------------------------
# Step 2 — Parse explicit constraints from the hiring manager's specification
# ---------------------------------------------------------------------------

async def parse_hm_spec(spec_text: str) -> dict:
    if not spec_text.strip():
        return {}

    return await _json_call(f"""You are parsing a hiring manager's specification for a technical interview codebase.

HM Specification:
{spec_text}

Extract structured constraints. Use null for anything not mentioned.

Return JSON with exactly these keys:
{{
  "domain_flavor": string or null — specific domain/context (e.g. "internal logistics dashboard", "payment processing service"),
  "topics_to_test": list of strings — specific technical concepts they want tested (e.g. ["race conditions", "N+1 queries", "cache invalidation"]),
  "excluded_topics": list of strings — things to avoid (e.g. ["authentication", "TypeScript"]),
  "difficulty_override": null | "easier" | "standard" | "harder" | "expert",
  "hard_stack": list of strings — exact technologies required (overrides JD inference),
  "company_context": string or null — any company/team flavor mentioned,
  "depth_hint": null | "shallow" | "standard" | "deep"
}}

depth_hint guidance: "shallow" = simple focused app 5-8 files; "standard" = realistic feature-rich app 8-15 files; "deep" = multi-layer system 15-30+ files (for system design topics like caching, API gateway, async workers, DB layers).""")


# ---------------------------------------------------------------------------
# Step 3 — Reconcile JD inferences and HM constraints into a merged brief
# ---------------------------------------------------------------------------

async def reconcile_brief(jd_brief: dict, hm_brief: dict) -> dict:
    return await _json_call(f"""You are merging two sources of signal into a single codebase specification for a technical interview.

Source 1 — Inferred from Job Description (lower priority, fills gaps):
{json.dumps(jd_brief, indent=2)}

Source 2 — Explicit Hiring Manager Specification (higher priority, overrides JD on any shared dimension):
{json.dumps(hm_brief, indent=2)}

Merging rules:
- HM spec fields override JD fields when both address the same dimension
- JD fields fill in gaps the HM spec left null
- "topics_to_test" is additive: union of both sources, deduplicated
- "stack" should use HM hard_stack if provided, otherwise JD implied_stack; merge if both present
- "depth_hint": HM spec takes precedence; if null, infer from role_level (intern/junior → shallow, mid → standard, senior/staff → deep)
- Record any direct contradictions in "conflicts"

Return JSON:
{{
  "domain": string,
  "role_level": "intern" | "junior" | "mid" | "senior" | "staff",
  "stack": list of technology strings,
  "topics_to_test": list of skill/concept strings,
  "excluded_topics": list of strings,
  "difficulty": "easier" | "standard" | "harder" | "expert",
  "depth_hint": "shallow" | "standard" | "deep",
  "company_context": string or null,
  "conflicts": list of conflict description strings (empty list if none)
}}""")


# ---------------------------------------------------------------------------
# Step 4 — Plan the codebase structure and seams
# ---------------------------------------------------------------------------

_TECH_LABELS: dict[str, str] = {
    "react_javascript": "React (JavaScript / JSX)",
    "python": "Python",
}

_DEPTH_GUIDANCE = {
    "shallow": "10-14 files. A focused app with real surface area — enough for a candidate to navigate meaningfully. Include a README, at least two frontend components, a service/API layer, and backend data handling.",
    "standard": "15-22 files. A feature-rich application. Multiple frontend components, service layer, utilities, backend routes, data access, config, tests, and a README.",
    "deep": (
        "22-35 files. A multi-layered system whose complexity matches the topics being tested. "
        "Include: API gateway, service layer, caching module, async job queue, "
        "database access layer, middleware, config/env handling, multiple domain models, "
        "integration clients, error handlers, background workers, tests, and a README. "
        "Match depth to what a real engineer working in this domain would actually encounter."
    ),
}


async def plan_codebase(merged_spec: dict, technologies: list) -> dict:
    depth = merged_spec.get("depth_hint", "standard")
    depth_guidance = _DEPTH_GUIDANCE.get(depth, _DEPTH_GUIDANCE["standard"])
    tech_str = ", ".join(_TECH_LABELS.get(t, t) for t in technologies) if technologies else "React (JavaScript / JSX) + Python"
    topics_str = ", ".join(merged_spec.get("topics_to_test", [])) or "general code quality and debugging"
    excluded_str = ", ".join(merged_spec.get("excluded_topics", [])) or "none"
    role = merged_spec.get("role_level", "mid")
    difficulty = merged_spec.get("difficulty", "standard")
    domain = merged_spec.get("domain", "web application")
    company = merged_spec.get("company_context") or "generic company"

    return await _json_call(f"""You are planning the file structure and intentional bugs for a technical interview codebase.

Assessment context:
- Domain: {domain}
- Technologies: {tech_str}
- Role level: {role}
- Topics to test: {topics_str}
- Excluded topics: {excluded_str}
- Difficulty: {difficulty}
- Company context: {company}
- Depth: {depth_guidance}

Design a realistic, coherent codebase that a {role}-level engineer would encounter at this company. The code should look like it was written by a real team — not a tutorial or toy project. Use domain-appropriate naming (variable names, function names, data shapes should reflect the actual business domain).

REQUIRED: README.md must be the first file in the list. It should describe what the app does, how to run it, and the high-level architecture. This is the first thing candidates read in the interview.

Then design 3-6 intentional "seams" — subtle bugs or design flaws baked into the code. Each seam must:
1. Be subtle: not a typo or obvious syntax error, but a logic flaw, off-by-one, missing edge case, performance antipattern, or design issue a skilled reviewer would notice
2. Directly test one of the "Topics to test" listed above
3. Look natural — it should read like an honest mistake a developer might make, not something contrived
4. NOT be marked with any comment (no "# BUG", "// TODO: fix this", etc.)

Return JSON:
{{
  "app_name": string,
  "app_description": string (2-3 sentences describing what the app does and what problem it solves),
  "files": [
    {{
      "path": string (e.g. "src/components/UserList.jsx"),
      "language": "javascript" | "jsx" | "typescript" | "tsx" | "python" | "markdown" | "text" | "json" | "yaml" | "css",
      "purpose": string (one sentence: what this file does and what it contains),
      "has_seam": boolean
    }}
  ],
  "seams": [
    {{
      "id": string (snake_case identifier),
      "description": string (precise description of what the bug is — enough detail to write it),
      "target_file": string (path from files list),
      "rubric_topic": string (3-6 word scoring dimension title, e.g. "Cache Invalidation Strategy"),
      "how_to_make_subtle": string (guidance for writing the bug so it reads naturally, not obviously wrong)
    }}
  ]
}}""", temperature=0.3)


# ---------------------------------------------------------------------------
# Step 5 — Generate each file's content
# ---------------------------------------------------------------------------

async def generate_file(
    file_spec: dict,
    plan: dict,
    seams_for_this_file: list,
    all_file_specs: list,
) -> str:
    file_manifest = "\n".join(
        f"  {f['path']} — {f['purpose']}" for f in all_file_specs
    )

    seam_block = ""
    if seams_for_this_file:
        seam_lines = "\n".join(
            f"- [{s['id']}] {s['description']}\n  How to keep it subtle: {s['how_to_make_subtle']}"
            for s in seams_for_this_file
        )
        seam_block = f"\n\nCRITICAL — this file must contain these intentional issues (write them naturally, do NOT mark them with comments):\n{seam_lines}"

    prompt = f"""You are writing one file of a technical interview codebase.

App: {plan["app_name"]}
{plan["app_description"]}

Full file manifest (so your imports and exports are consistent):
{file_manifest}

Write: {file_spec["path"]}
Purpose: {file_spec["purpose"]}
Language: {file_spec["language"]}{seam_block}

Rules:
- Write realistic, production-looking code — not tutorial or toy code
- Variable names, data shapes, and comments should match the app domain
- Imports and exports must be consistent with the other files listed above
- No high-level explanatory comment blocks describing what the file does — write like a real engineer did
- Do NOT add any comment flagging a seam as intentional (no "# BUG", "// intentional", "# FIXME" etc.)
- Return ONLY the file content — no markdown code fences, no explanation before or after

File content:"""

    async with _FILE_GEN_SEM:
        response = await client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
        )
    content = response.choices[0].message.content.strip()
    # Strip markdown code fences the model sometimes adds despite instructions.
    if content.startswith("```"):
        lines = content.split("\n")
        lines = lines[1:]  # drop opening ```language line
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]  # drop closing ```
        content = "\n".join(lines).strip()
    return content


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def generate_codebase(
    jd_text: str,
    hm_spec: str,
    technologies: list,
) -> dict:
    """
    Full 5-step pipeline: JD + HM spec + technologies → codebase files.

    Returns:
      {
        "files": [{"path": str, "language": str, "content": str}, ...],
        "merged_spec": {...},   # stored as codebase_spec JSONB on the assessment
        "seam_topics": [...]    # rubric_topic strings from all seams
      }
    """
    # Steps 1-2 in parallel (independent)
    jd_brief, hm_brief = await asyncio.gather(
        extract_jd_brief(jd_text),
        parse_hm_spec(hm_spec),
    )

    # Step 3: reconcile into merged brief
    merged_spec = await reconcile_brief(jd_brief, hm_brief)

    # Step 4: plan file structure and seams
    plan = await plan_codebase(merged_spec, technologies)

    # Index seams by the file they target
    seams_by_file: dict[str, list] = {}
    for seam in plan.get("seams", []):
        target = seam.get("target_file", "")
        seams_by_file.setdefault(target, []).append(seam)

    # Ensure README.md is always present — move it to front if planned, add it if missing.
    file_specs = plan.get("files", [])
    readme_specs = [f for f in file_specs if f.get("path", "").lower() in ("readme.md", "readme")]
    non_readme = [f for f in file_specs if f.get("path", "").lower() not in ("readme.md", "readme")]
    if not readme_specs:
        readme_specs = [{"path": "README.md", "language": "markdown", "purpose": "Project overview, setup instructions, and architecture summary.", "has_seam": False}]
    file_specs = readme_specs + non_readme
    plan["files"] = file_specs

    # Step 5: generate all files in parallel
    contents = await asyncio.gather(*[
        generate_file(
            file_spec=f,
            plan=plan,
            seams_for_this_file=seams_by_file.get(f["path"], []),
            all_file_specs=file_specs,
        )
        for f in file_specs
    ])

    files = [
        {"path": f["path"], "language": f["language"], "content": content}
        for f, content in zip(file_specs, contents)
    ]

    seam_topics = [s["rubric_topic"] for s in plan.get("seams", [])]

    # Annotate merged_spec with plan metadata so it's a useful stored artifact
    merged_spec["app_name"] = plan.get("app_name", "")
    merged_spec["app_description"] = plan.get("app_description", "")
    merged_spec["seams"] = plan.get("seams", [])
    merged_spec["file_count"] = len(files)

    return {
        "files": files,
        "merged_spec": merged_spec,
        "seam_topics": seam_topics,
    }
