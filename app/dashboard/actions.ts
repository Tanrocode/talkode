"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  assessmentTechnologyLabels,
  type AssessmentTechnology,
  type RubricSource,
} from "@/app/dashboard/data";
import { createClient } from "@/lib/supabase/server";
import { extractRubricTopics } from "@/lib/voiceAgent";

type AssessmentField =
  | "expirationDate"
  | "jobDescription"
  | "rubricFile"
  | "rubricSource"
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
const rubricSources: RubricSource[] = ["generated", "uploaded"];

function readFormString(formData: FormData, key: AssessmentField) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
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

function isRubricSource(value: string): value is RubricSource {
  return rubricSources.includes(value as RubricSource);
}

async function readUploadedRubric(formData: FormData) {
  const rubricFile = formData.get("rubricFile");

  if (!(rubricFile instanceof File) || rubricFile.size === 0) {
    return {
      error: "Upload a rubric file.",
      text: "",
    };
  }

  return {
    error: undefined,
    text: await rubricFile.text(),
  };
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
  const rubricSourceValue = readFormString(formData, "rubricSource");
  const timeLimitMinutes = Number(timeLimitValue);
  const expirationDate = parseExpirationDate(expirationDateValue);
  const selectedTechnologies = Array.from(
    new Set(
      formData
        .getAll("technologies")
        .filter((technology): technology is string => typeof technology === "string")
        .filter(isAssessmentTechnology),
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

  if (!isRubricSource(rubricSourceValue)) {
    fieldErrors.rubricSource = "Choose a rubric option.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      fieldErrors,
      message: "Check the highlighted fields.",
      status: "error",
    };
  }

  if (
    selectedTechnologies.length === 0 ||
    !expirationDate ||
    !isRubricSource(rubricSourceValue)
  ) {
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
      message: "No codebase template matches those technologies.",
      status: "error",
    };
  }

  let rubricText = "";

  if (rubricSourceValue === "uploaded") {
    const uploadedRubric = await readUploadedRubric(formData);

    if (uploadedRubric.error) {
      return {
        fieldErrors: {
          rubricFile: uploadedRubric.error,
        },
        message: "Check the highlighted fields.",
        status: "error",
      };
    }

    rubricText = uploadedRubric.text;
  } else {
    const { data: rubricTemplate, error: rubricError } = await supabase
      .from("assessment_rubric_templates")
      .select("content")
      .eq("codebase_template_id", codebaseTemplate.id)
      .maybeSingle();

    if (rubricError || !rubricTemplate) {
      return {
        message: "No rubric template is available for this codebase.",
        status: "error",
      };
    }

    rubricText = rubricTemplate.content;
  }

  const technologyLabel = selectedTechnologies
    .map((technology) => assessmentTechnologyLabels[technology])
    .join(" + ");

  let rubricTopics: string[] = [];
  try {
    rubricTopics = (await extractRubricTopics(rubricText)).topics;
  } catch {
    rubricTopics = [];
  }

  const { data: insertedAssessment, error: insertError } = await supabase
    .from("assessments")
    .insert({
      codebase_template_id: codebaseTemplate.id,
      created_by: userResult.user.id,
      due_at: expirationDate.toISOString(),
      job_description: jobDescription,
      organization_id: profile.organization_id,
      role_name: technologyLabel,
      rubric_source: rubricSourceValue,
      rubric_text: rubricText,
      rubric_topics: rubricTopics,
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
