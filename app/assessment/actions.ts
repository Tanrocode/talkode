"use server";

import type { CodebaseFile } from "@/app/dashboard/data";
import type { AuthFormState } from "@/app/auth/form-state";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

type CandidateEntryField = "accessCode" | "fullName";

export type CandidateAssessmentSession = {
  assessmentId: string;
  candidateId: string;
  candidateName: string;
  codeFiles: CodebaseFile[];
  expiresAt: string | null;
  technologies: string[];
  timeLimitMinutes: number;
  title: string;
  rubric: string;
};

export type CandidateEntryState = {
  fieldErrors?: Partial<Record<CandidateEntryField, string>>;
  message?: string;
  session?: CandidateAssessmentSession;
  status: AuthFormState["status"] | "ready";
};

function readFormString(formData: FormData, key: CandidateEntryField) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCode(value: string) {
  return value.replace(/\s+/g, "").toUpperCase();
}

function isCodebaseFile(value: unknown): value is CodebaseFile {
  if (!value || typeof value !== "object") {
    return false;
  }

  const file = value as Partial<CodebaseFile>;

  return (
    typeof file.content === "string" &&
    typeof file.language === "string" &&
    typeof file.lineCount === "number" &&
    typeof file.path === "string"
  );
}

function parseCodeFiles(value: unknown): CodebaseFile[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isCodebaseFile);
}

export async function joinAssessment(
  _previousState: CandidateEntryState,
  formData: FormData,
): Promise<CandidateEntryState> {
  const accessCode = normalizeCode(readFormString(formData, "accessCode"));
  const fullName = readFormString(formData, "fullName");
  const fieldErrors: CandidateEntryState["fieldErrors"] = {};

  if (accessCode.length < 4) {
    fieldErrors.accessCode = "Enter the assessment code.";
  }

  if (fullName.length < 2) {
    fieldErrors.fullName = "Enter your full name.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      fieldErrors,
      message: "Check the highlighted fields.",
      status: "error",
    };
  }

  if (!hasSupabaseConfig()) {
    return {
      message: "Supabase is not configured yet.",
      status: "error",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "register_candidate_for_assessment",
    {
      p_access_code: accessCode,
      p_full_name: fullName,
    },
  );

  const session = data?.[0];

  if (error || !session) {
    return {
      message: error?.message ?? "That assessment code could not be opened.",
      status: "error",
    };
  }

  return {
    session: {
      assessmentId: session.assessment_id,
      candidateId: session.candidate_id,
      candidateName: session.candidate_name,
      codeFiles: parseCodeFiles(session.code_files),
      expiresAt: session.expires_at,
      technologies: session.technologies,
      timeLimitMinutes: session.time_limit_minutes,
      title: session.assessment_title,
      rubric: session.rubric_text ?? "",
    },
    status: "ready",
  };
}
