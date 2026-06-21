import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCreateAssessmentData } from "@/app/dashboard/data";
import { CreateAssessmentForm } from "@/app/dashboard/assessments/new/CreateAssessmentForm";

export const metadata: Metadata = {
  title: "Create Assessment | Chayote",
};

export default async function NewAssessmentPage() {
  const { error, templates } = await getCreateAssessmentData();

  return (
    <>
      <section className="max-w-[1120px]">
        <Link
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#55594f] transition duration-150 hover:text-[#202322]"
          href="/dashboard/assessments"
        >
          <ArrowLeft size={14} />
          Assessments
        </Link>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-[28px] font-black leading-tight text-[#202322]">
              Create assessment
            </h1>
          </div>
        </div>
      </section>

      {error ? (
        <p className="mt-4 rounded-[6px] border border-[#eadbd4] bg-[#fff8f5] px-4 py-3 text-sm text-[#7a3a27]">
          {error}
        </p>
      ) : null}

      <CreateAssessmentForm templates={templates} />
    </>
  );
}
