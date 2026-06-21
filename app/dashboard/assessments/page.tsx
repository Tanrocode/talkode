import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import {
  getAssessmentsData,
  type AssessmentStatus,
} from "@/app/dashboard/data";

export const metadata: Metadata = {
  title: "Assessments | Chayote",
};

function statusClass(status: AssessmentStatus) {
  if (status === "live") {
    return "bg-[#d7ff5a] text-[#202322]";
  }

  if (status === "reviewing") {
    return "bg-[#202322] text-white";
  }

  if (status === "complete") {
    return "bg-[#e5e8df] text-[#4f564a]";
  }

  return "bg-[#efeeeb] text-[#555a51]";
}

export default async function AssessmentsPage() {
  const { assessments, error } = await getAssessmentsData();

  return (
    <>
      <section className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-[28px] font-black leading-tight text-[#202322]">
            Assessments
          </h1>
        </div>
        <Link
          className="inline-flex h-9 items-center justify-center gap-2 rounded-[3px] bg-primary px-3 text-[13px] font-bold text-[#111510] transition duration-150 hover:bg-[#d7ff5a] sm:w-fit"
          href="/dashboard/assessments/new"
        >
          <Plus size={16} />
          Create assessment
        </Link>
      </section>

      {error ? (
        <p className="mt-4 rounded-[6px] border border-[#eadbd4] bg-[#fff8f5] px-4 py-3 text-sm text-[#7a3a27]">
          {error}
        </p>
      ) : null}

      <section className="mt-6 grid gap-4 xl:grid-cols-2">
        {assessments.length > 0 ? (
          assessments.map((assessment) => (
            <article className="rounded-[8px] border border-[#f0eeea] bg-white p-4" key={assessment.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-[#62675e]">
                    {assessment.id}
                  </p>
                  <h2 className="mt-2 text-xl font-bold">{assessment.title}</h2>
                  <p className="mt-2 text-sm text-[#62675e]">
                    {assessment.technologyLabel}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                    assessment.status,
                  )}`}
                >
                  {assessment.statusLabel}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs font-semibold text-[#6b7067]">
                    Candidates
                  </p>
                  <p className="mt-2 text-2xl font-bold">
                    {assessment.candidateCount}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#6b7067]">
                    Time
                  </p>
                  <p className="mt-2 text-2xl font-bold">
                    {assessment.timeLimitMinutes}m
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#6b7067]">
                    Completion
                  </p>
                  <p className="mt-2 text-2xl font-bold">
                    {assessment.completionPercent}%
                  </p>
                </div>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#efeeeb]">
                <div
                  className="h-full rounded-full bg-[#c8f23d]"
                  style={{ width: `${assessment.completionPercent}%` }}
                />
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 text-sm text-[#62675e]">
                <span>Expires {assessment.dueLabel}</span>
                <Link
                  className="font-semibold text-[#202322] underline-offset-4 transition duration-150 hover:underline"
                  href={`/dashboard/assessments/${assessment.id}`}
                >
                  Open
                </Link>
              </div>
            </article>
          ))
        ) : (
          <p className="rounded-[8px] border border-[#f0eeea] bg-white px-4 py-8 text-sm text-[#62675e]">
            No assessments found in Supabase.
          </p>
        )}
      </section>
    </>
  );
}
