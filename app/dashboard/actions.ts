"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  assessmentTechnologyLabels,
  type AssessmentTechnology,
} from "@/app/dashboard/data";
import {
  buildRubricTable,
  findRubricCriteria,
} from "@/lib/assessment-rubric";
import { createClient } from "@/lib/supabase/server";

type AssessmentField =
  | "customRubricCriteria"
  | "expirationDate"
  | "jobDescription"
  | "rubricCriteria"
  | "technologies"
  | "timeLimitMinutes"
  | "title";

export type CreateAssessmentFormState = {
  fieldErrors?: Partial<Record<AssessmentField, string>>;
  message?: string;
  status: "idle" | "error";
};

const assessmentTechnologies: AssessmentTechnology[] = [
  "react_javascript",
  "python",
];

function readFormString(formData: FormData, key: AssessmentField) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readCustomRubricCriteria(formData: FormData) {
  return readFormString(formData, "customRubricCriteria")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseExpirationDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }

  const expirationDate = new Date(`${value}T23:59:59.999Z`);

  if (Number.isNaN(expirationDate.getTime())) {
    return undefined;
  }

  return expirationDate;
}

function isAssessmentTechnology(value: string): value is AssessmentTechnology {
  return assessmentTechnologies.includes(value as AssessmentTechnology);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  redirect("/auth");
}

export async function createAssessment(
  _previousState: CreateAssessmentFormState,
  formData: FormData,
): Promise<CreateAssessmentFormState> {
  const title = readFormString(formData, "title");
  const expirationDateValue = readFormString(formData, "expirationDate");
  const jobDescription = readFormString(formData, "jobDescription");
  const timeLimitValue = readFormString(formData, "timeLimitMinutes");
  const timeLimitMinutes = Number(timeLimitValue);
  const expirationDate = parseExpirationDate(expirationDateValue);
  const customRubricCriteria = readCustomRubricCriteria(formData);
  const selectedTechnologies = Array.from(
    new Set(
      formData
        .getAll("technologies")
        .filter((technology): technology is string => typeof technology === "string")
        .filter(isAssessmentTechnology),
    ),
  );
  const selectedRubricCriteria = findRubricCriteria(
    Array.from(
      new Set(
        formData
          .getAll("rubricCriteria")
          .filter((criterion): criterion is string => typeof criterion === "string"),
      ),
    ),
  );
  const fieldErrors: CreateAssessmentFormState["fieldErrors"] = {};

  if (title.length < 2) {
    fieldErrors.title = "Enter an assessment title.";
  }

  if (!expirationDate || expirationDate.getTime() < Date.now()) {
    fieldErrors.expirationDate = "Choose a future expiration date.";
  }

  if (
    !Number.isInteger(timeLimitMinutes) ||
    timeLimitMinutes < 20 ||
    timeLimitMinutes > 60
  ) {
    fieldErrors.timeLimitMinutes = "Use a time limit from 20 to 60 minutes.";
  }

  if (selectedTechnologies.length === 0) {
    fieldErrors.technologies = "Choose at least one technology.";
  }

  if (jobDescription.length < 10) {
    fieldErrors.jobDescription = "Enter a job description.";
  }

  if (selectedRubricCriteria.length === 0 && customRubricCriteria.length === 0) {
    fieldErrors.rubricCriteria =
      "Choose at least one rubric criterion or add a custom one.";
  }

  if (customRubricCriteria.some((criterion) => criterion.length < 12)) {
    fieldErrors.customRubricCriteria =
      "Make each custom criterion specific enough to grade.";
  }

  if (customRubricCriteria.some((criterion) => criterion.length > 240)) {
    fieldErrors.customRubricCriteria =
      "Keep each custom criterion under 240 characters.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      fieldErrors,
      message: "Check the highlighted fields.",
      status: "error",
    };
  }

  if (selectedTechnologies.length === 0 || !expirationDate) {
    return {
      message: "Check the highlighted fields.",
      status: "error",
    };
  }

  const supabase = await createClient();
  const { data: userResult, error: userError } = await supabase.auth.getUser();

  if (userError || !userResult.user) {
    return {
      message: "Sign in to create assessments.",
      status: "error",
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("recruiter_profiles")
    .select("organization_id,status")
    .eq("id", userResult.user.id)
    .maybeSingle();

  if (profileError || !profile || profile.status !== "active") {
    return {
      message: "Active recruiter access is required.",
      status: "error",
    };
  }

  const { data: codebaseTemplate, error: templateError } = await supabase
    .from("assessment_codebase_templates")
    .select("id,title")
    .eq("slug", "employee-directory-dashboard")
    .eq("is_active", true)
    .maybeSingle();

  if (templateError || !codebaseTemplate) {
    return {
      message: "No Supabase codebase template matches those technologies.",
      status: "error",
    };
  }

  const rubricText = buildRubricTable({
    customCriteria: customRubricCriteria,
    selectedCriteria: selectedRubricCriteria,
  });

  const technologyLabel = selectedTechnologies
    .map((technology) => assessmentTechnologyLabels[technology])
    .join(" + ");

  const { data: insertedAssessment, error: insertError } = await supabase
    .from("assessments")
    .insert({
      codebase_template_id: codebaseTemplate.id,
      created_by: userResult.user.id,
      due_at: expirationDate.toISOString(),
      job_description: jobDescription,
      organization_id: profile.organization_id,
      role_name: technologyLabel,
      rubric_source: "generated",
      rubric_text: rubricText,
      status: "draft",
      technologies: selectedTechnologies,
      time_limit_minutes: timeLimitMinutes,
      title,
    })
    .select("id")
    .single();

  if (insertError || !insertedAssessment) {
    return {
      message: insertError?.message ?? "Assessment was not created.",
      status: "error",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/assessments");
  redirect(`/dashboard/assessments/${insertedAssessment.id}?created=1`);
}
