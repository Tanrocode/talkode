const SEGMENT_COUNT = 4;

function isValidRubricScore(score: unknown): score is number {
  return typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 4;
}

// Traffic-light coloring so a score reads at a glance: low = red, mid = amber, high = green.
function scoreColor(filled: number): string {
  if (filled <= 1) return "bg-[#ffb4a8]";
  if (filled === 2) return "bg-[#ffd166]";
  return "bg-[#d7ff5a]";
}

function scoreTextColor(filled: number): string {
  if (filled <= 1) return "text-[#80321d]";
  if (filled === 2) return "text-[#6f5314]";
  return "text-[#202322]";
}

export function RubricBar({ score }: { score: unknown }) {
  if (!isValidRubricScore(score)) {
    return (
      <span className="shrink-0 rounded-full bg-[#ebe9e6] px-2.5 py-0.5 text-xs font-semibold text-[#62675e]">
        {typeof score === "string" ? score : "—"}
      </span>
    );
  }

  const filled = Math.round(score);
  const fillColor = scoreColor(filled);
  return (
    <div className="flex shrink-0 items-center gap-2">
      <div className="flex gap-0.5">
        {Array.from({ length: SEGMENT_COUNT }).map((_, i) => (
          <span
            key={i}
            className={`h-2 w-4 rounded-[2px] ${i < filled ? fillColor : "bg-[#ebe9e6]"}`}
          />
        ))}
      </div>
      <span className={`font-mono text-xs font-bold ${scoreTextColor(filled)}`}>{filled}/4</span>
    </div>
  );
}
