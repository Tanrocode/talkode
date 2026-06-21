import type { Metadata } from "next";
import { CandidateAssessmentFlow } from "@/app/assessment/CandidateAssessmentFlow";

export const metadata: Metadata = {
  title: "Assessment Lobby | Chayote",
  description: "Enter an assessment code and prepare your equipment.",
};

type AssessmentPageProps = {
  searchParams: Promise<{
    accessCode?: string | string[];
    code?: string | string[];
  }>;
};

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeAccessCode(value: string | undefined) {
  return value?.replace(/\s+/g, "").toUpperCase() ?? "";
}

export default async function AssessmentPage({
  searchParams,
}: AssessmentPageProps) {
  const params = await searchParams;
  const initialAccessCode = normalizeAccessCode(
    readParam(params.code) ?? readParam(params.accessCode),
  );

  return <CandidateAssessmentFlow initialAccessCode={initialAccessCode} />;
}
