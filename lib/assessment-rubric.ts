export type RubricCriterion = {
  evidence: string;
  id: string;
  label: string;
  score1: string;
  score2: string;
  score3: string;
  score4: string;
};

export const predefinedRubricCriteria: RubricCriterion[] = [
  {
    id: "codebase-navigation",
    label: "Codebase navigation and data flow",
    evidence:
      "Must trace the path from the API response through hook/state, filtering, sorting, statistics, and rendered employee cards. Must name the files or functions involved.",
    score1:
      "Gives a generic overview of React or APIs without naming this codebase's files, state, or data flow.",
    score2:
      "Names a few files but cannot accurately connect API data to rendered UI behavior.",
    score3:
      "Correctly traces the main code path and explains the responsibilities of the relevant modules.",
    score4:
      "Traces the code path plus edge cases, state ownership, derived data, and where regressions would most likely enter.",
  },
  {
    id: "search-filter-correctness",
    label: "Search, filtering, and data correctness",
    evidence:
      "Must explain exact failure modes for search/filter/status behavior, including case, whitespace, department/status normalization, and how those values move through the UI.",
    score1:
      "Says to 'fix search' or 'check filters' without identifying a concrete failure mode.",
    score2:
      "Identifies one symptom but misses the underlying normalization or state interaction.",
    score3:
      "Explains the exact bug, affected data fields, user-visible result, and a targeted fix.",
    score4:
      "Explains multiple edge cases, proposes focused tests, and distinguishes data issues from UI-state issues.",
  },
  {
    id: "react-rendering-state",
    label: "React rendering, state, and list identity",
    evidence:
      "Must reason about derived state, list keys, mutation, re-render behavior, and how React would reconcile employee rows under sorting/filtering changes.",
    score1:
      "Uses broad React terms without connecting them to this component tree or list rendering.",
    score2:
      "Mentions state or keys but cannot explain the actual symptom or reconciliation behavior.",
    score3:
      "Identifies the relevant state/render issue and gives a concrete code-level correction.",
    score4:
      "Connects rendering behavior to user-visible bugs, stable identity, immutability, and maintainable component boundaries.",
  },
  {
    id: "performance-scale",
    label: "Performance and scale reasoning",
    evidence:
      "Must identify what changes with large employee datasets, including repeated filtering/sorting, expensive statistics, render cost, and client/server tradeoffs.",
    score1:
      "Only says to 'optimize' or 'use memoization' without describing the expensive work.",
    score2:
      "Names a performance tool but cannot map it to the data size or computation pattern.",
    score3:
      "Identifies specific hot paths and proposes appropriate memoization, pagination, or server-side work.",
    score4:
      "Prioritizes fixes by complexity and product impact, and explains measurement or profiling strategy.",
  },
  {
    id: "debugging-evidence",
    label: "Debugging method and validation",
    evidence:
      "Must show how they would reproduce, isolate, inspect, and verify a bug using concrete inputs, expected output, and a minimal test or instrumentation plan.",
    score1:
      "Guesses a fix without a reproduction, expected result, or validation step.",
    score2:
      "Can reproduce a symptom but does not isolate source or define a clear expected behavior.",
    score3:
      "Uses a focused reproduction, identifies likely source, and defines a concrete verification step.",
    score4:
      "Builds a reliable debugging chain from input to output, covers regressions, and proposes targeted tests.",
  },
  {
    id: "api-contract-backend",
    label: "API contract and backend integration",
    evidence:
      "Must describe the employee API shape, frontend assumptions about that shape, failure states, and how a FastAPI or service boundary should protect the UI.",
    score1:
      "Talks about backend integration generically without describing the API shape or contract.",
    score2:
      "Mentions endpoint or fields but misses error handling, schema drift, or frontend assumptions.",
    score3:
      "Explains the contract, identifies a brittle assumption, and proposes validation or error handling.",
    score4:
      "Connects schema, errors, loading states, test data, and deployment concerns into a clear contract strategy.",
  },
  {
    id: "product-prioritization",
    label: "Product impact and prioritization",
    evidence:
      "Must separate correctness, usability, performance, and maintainability issues, then justify priority using user impact and risk.",
    score1:
      "Lists technical preferences without explaining user or business impact.",
    score2:
      "Recognizes impact but cannot prioritize among competing issues.",
    score3:
      "Prioritizes issues with a clear user-facing rationale and reasonable sequencing.",
    score4:
      "Balances user trust, operational risk, implementation cost, and follow-up instrumentation.",
  },
  {
    id: "communication-depth",
    label: "Communication and depth under follow-up",
    evidence:
      "Must answer follow-ups with specific code references, constraints, tradeoffs, and verification steps instead of rehearsed definitions.",
    score1:
      "Relies on memorized definitions or polished but generic explanations.",
    score2:
      "Explains concepts but needs repeated prompting to connect them to this codebase.",
    score3:
      "Communicates a clear, code-specific reasoning path with limited prompting.",
    score4:
      "Thinks aloud precisely, revises assumptions when evidence changes, and explains tradeoffs at system level.",
  },
];

function escapeTableCell(value: string) {
  return value.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}

function customCriterion(label: string, index: number): RubricCriterion {
  return {
    id: `custom-${index + 1}`,
    label,
    evidence:
      "Must anchor the answer in this codebase by naming relevant files, functions, data fields, failure modes, and a concrete validation step.",
    score1:
      "Generic or unsupported claim with no concrete codebase reference.",
    score2:
      "Mentions a relevant area but cannot trace behavior or define verification.",
    score3:
      "Explains the exact code path, failure mode, and a reasonable fix or test.",
    score4:
      "Connects code path, edge cases, tradeoffs, and validation with minimal prompting.",
  };
}

export function buildRubricTable({
  customCriteria,
  selectedCriteria,
}: {
  customCriteria: string[];
  selectedCriteria: RubricCriterion[];
}) {
  const rows = [
    ...selectedCriteria,
    ...customCriteria.map((criterion, index) =>
      customCriterion(criterion, index),
    ),
  ];

  return [
    "# Assessment Rubric",
    "",
    "Grade each requirement independently from 1 to 4. A score of 3 or 4 requires concrete evidence from this codebase, not a generic concept explanation.",
    "",
    "Interviewer enforcement rules:",
    "- Do not accept broad definitions as sufficient evidence.",
    "- If an answer is generic, ask a targeted follow-up that forces the candidate to name files, functions, data fields, state transitions, failure modes, tests, or tradeoffs.",
    "- Move to the next requirement only after collecting code-specific evidence or making a clear note that evidence was missing.",
    "",
    "| Requirement | Evidence interviewer must collect | Score 1 | Score 2 | Score 3 | Score 4 |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows.map((criterion) =>
      [
        escapeTableCell(criterion.label),
        escapeTableCell(criterion.evidence),
        escapeTableCell(criterion.score1),
        escapeTableCell(criterion.score2),
        escapeTableCell(criterion.score3),
        escapeTableCell(criterion.score4),
      ].join(" | "),
    ).map((row) => `| ${row} |`),
  ].join("\n");
}

export function findRubricCriteria(ids: string[]) {
  const criteriaById = new Map(
    predefinedRubricCriteria.map((criterion) => [criterion.id, criterion]),
  );

  return ids
    .map((id) => criteriaById.get(id))
    .filter((criterion): criterion is RubricCriterion => Boolean(criterion));
}
