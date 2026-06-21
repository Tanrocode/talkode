import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, CalendarDays, Clock3, Files, RadioTower } from "lucide-react";
import { getAssessmentDetailsData } from "@/app/dashboard/data";
import { CodebaseFilesModal } from "@/components/dashboard/CodebaseFilesModal";
import { AssessmentLinkGenerator } from "@/components/dashboard/AssessmentLinkGenerator";
import { getSiteUrl } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Assessment | Chayote",
};

type AssessmentDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    created?: string;
  }>;
};

function DetailMetric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="border border-[#ebe8e1] bg-white px-3 py-2.5">
      <div className="flex items-center gap-2 text-[11px] font-semibold text-[#62675e]">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-lg font-black leading-none text-[#202322]">{value}</p>
    </div>
  );
}

export default async function AssessmentDetailPage({
  params,
  searchParams,
}: AssessmentDetailPageProps) {
  const { id } = await params;
  const { created } = await searchParams;
  const { assessment, codebaseFiles, error } =
    await getAssessmentDetailsData(id);
  const assessmentLink = assessment
    ? `${getSiteUrl()}/assessment?code=${encodeURIComponent(
        assessment.candidateAccessCode,
      )}`
    : "";

  return (
    <>
      <section className="max-w-[1040px]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <Link
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#55594f] transition duration-150 hover:text-[#202322]"
              href="/dashboard/assessments"
            >
              <ArrowLeft size={14} />
              Assessments
            </Link>

            <h1 className="mt-4 text-[30px] font-black leading-tight text-[#202322]">
              {assessment?.title ?? "Assessment"}
            </h1>
            {assessment ? (
              <p className="mt-2 max-w-[700px] text-sm leading-6 text-[#55594f]">
                {assessment.technologyLabel} - {assessment.timeLimitMinutes}{" "}
                minutes
              </p>
            ) : null}
          </div>

          {assessment ? (
            <CodebaseFilesModal
              files={codebaseFiles}
              title={`${assessment.title} codebase`}
              triggerLabel="Code files"
            />
          ) : null}
        </div>
      </section>

      {created === "1" ? (
        <p className="mt-4 rounded-[6px] border border-[#d7e8a6] bg-[#fbffe8] px-4 py-3 text-sm font-medium text-[#314200]">
          Assessment created.
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-[6px] border border-[#eadbd4] bg-[#fff8f5] px-4 py-3 text-sm text-[#7a3a27]">
          {error}
        </p>
      ) : null}

      {assessment ? (
        <section className="mt-6 grid max-w-[1040px] gap-4 lg:grid-cols-[360px_1fr]">
          <div className="grid content-start gap-4">
            <AssessmentLinkGenerator
              accessCode={assessment.candidateAccessCode}
              assessmentLink={assessmentLink}
            />

            <div className="grid grid-cols-2 gap-2">
              <DetailMetric
                icon={<RadioTower size={14} />}
                label="Status"
                value={assessment.statusLabel}
              />
              <DetailMetric
                icon={<Clock3 size={14} />}
                label="Time"
                value={`${assessment.timeLimitMinutes}m`}
              />
              <DetailMetric
                icon={<CalendarDays size={14} />}
                label="Expires"
                value={assessment.dueLabel}
              />
              <DetailMetric
                icon={<Files size={14} />}
                label="Files"
                value={`${codebaseFiles.length}`}
              />
            </div>
          </div>

          <article className="border border-[#ebe8e1] bg-white p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#62675e]">
              Job description
            </p>
            <div className="mt-3 max-h-[320px] overflow-y-auto pr-3">
              <p className="max-w-[680px] whitespace-pre-wrap text-sm leading-7 text-[#4f554d]">
                {assessment.jobDescription}
              </p>
            </div>
          </article>
        </section>
      ) : null}
    </>
  );
}
