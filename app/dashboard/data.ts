import type { Database } from "@/lib/database.types";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

type AssessmentRow = Database["public"]["Tables"]["assessments"]["Row"];
type CodebaseTemplateRow =
  Database["public"]["Tables"]["assessment_codebase_templates"]["Row"];
type CodebaseFileRow =
  Database["public"]["Tables"]["assessment_codebase_files"]["Row"];
type CandidateRow = Database["public"]["Tables"]["candidates"]["Row"];
type RecruiterProfileRow =
  Database["public"]["Tables"]["recruiter_profiles"]["Row"];

export type AssessmentStatus =
  Database["public"]["Enums"]["assessment_status"];
export type CandidateStage = Database["public"]["Enums"]["candidate_stage"];
export type CandidateRisk = Database["public"]["Enums"]["candidate_risk"];
export type AssessmentTechnology =
  Database["public"]["Enums"]["assessment_technology"];
export type RubricSource = Database["public"]["Enums"]["rubric_source"];

export type DashboardAssessment = {
  candidateCount: number;
  candidateAccessCode: string;
  codebaseTemplateId: string | null;
  completionPercent: number;
  dueLabel: string;
  id: string;
  jobDescription: string;
  medianScore: number | null;
  roleName: string;
  technologies: AssessmentTechnology[];
  technologyLabel: string;
  timeLimitMinutes: number;
  rubricSource: RubricSource;
  status: AssessmentStatus;
  statusLabel: string;
  title: string;
  updatedLabel: string;
};

export type DashboardCandidate = {
  activityLabel: string;
  id: string;
  name: string;
  risk: CandidateRisk;
  riskLabel: string;
  roleName: string;
  score: number | null;
  stage: CandidateStage;
  stageLabel: string;
};

export type DashboardData = {
  assessments: DashboardAssessment[];
  candidates: DashboardCandidate[];
  error?: string;
  profile: Pick<RecruiterProfileRow, "full_name" | "organization_id"> | null;
};

export type CodebaseFilePreview = {
  language: string;
  lineCount: number;
  path: string;
};

export type CodebaseFile = CodebaseFilePreview & {
  content: string;
};

export type CodebaseTemplateOption = {
  description: string;
  files: CodebaseFilePreview[];
  id: string;
  slug: string;
  technologies: AssessmentTechnology[];
  technologyLabel: string;
  title: string;
};

export type CreateAssessmentData = {
  error?: string;
  templates: CodebaseTemplateOption[];
};

export type AssessmentDetailsData = {
  assessment: DashboardAssessment | null;
  codebaseFiles: CodebaseFile[];
  error?: string;
};

const assessmentStatusLabels: Record<AssessmentStatus, string> = {
  complete: "Complete",
  draft: "Draft",
  live: "Live",
  reviewing: "Reviewing",
};

const candidateStageLabels: Record<CandidateStage, string> = {
  applied: "Applied",
  assessment: "Assessment",
  interview: "Interview",
  offer: "Offer",
};

const candidateRiskLabels: Record<CandidateRisk, string> = {
  high: "High",
  low: "Low",
  medium: "Medium",
};

export const assessmentTechnologyLabels: Record<AssessmentTechnology, string> = {
  python: "Python",
  react_javascript: "React (JavaScript)",
};

const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
});

function emptyDashboardData(error?: string): DashboardData {
  return {
    assessments: [],
    candidates: [],
    error,
    profile: null,
  };
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }

  return dateFormatter.format(date);
}

function formatAssessment(row: AssessmentRow): DashboardAssessment {
  const technologyLabel = row.technologies
    .map((technology) => assessmentTechnologyLabels[technology])
    .join(" + ");

  return {
    candidateCount: 0,
    candidateAccessCode: row.candidate_access_code,
    codebaseTemplateId: row.codebase_template_id,
    completionPercent: row.completion_percent,
    dueLabel: row.due_at ? formatDate(row.due_at) : "No due date",
    id: row.id,
    jobDescription: row.job_description,
    medianScore: row.median_score,
    roleName: row.role_name,
    technologies: row.technologies,
    technologyLabel,
    timeLimitMinutes: row.time_limit_minutes,
    rubricSource: row.rubric_source,
    status: row.status,
    statusLabel: assessmentStatusLabels[row.status],
    title: row.title,
    updatedLabel: formatDate(row.updated_at),
  };
}

function formatCandidate(row: CandidateRow): DashboardCandidate {
  return {
    activityLabel: row.last_activity_at
      ? formatDate(row.last_activity_at)
      : formatDate(row.updated_at),
    id: row.id,
    name: row.full_name,
    risk: row.risk,
    riskLabel: candidateRiskLabels[row.risk],
    roleName: row.role_name,
    score: row.score,
    stage: row.stage,
    stageLabel: candidateStageLabels[row.stage],
  };
}

function countCandidatesByAssessment(rows: CandidateRow[]) {
  return rows.reduce<Record<string, number>>((counts, candidate) => {
    if (!candidate.assessment_id) {
      return counts;
    }

    counts[candidate.assessment_id] = (counts[candidate.assessment_id] ?? 0) + 1;
    return counts;
  }, {});
}

function groupFilesByTemplate(rows: CodebaseFileRow[]) {
  return rows.reduce<Record<string, CodebaseFilePreview[]>>((groups, file) => {
    const files = groups[file.codebase_template_id] ?? [];

    files.push({
      language: file.language,
      lineCount: file.content.split("\n").length,
      path: file.path,
    });

    groups[file.codebase_template_id] = files;
    return groups;
  }, {});
}

function formatCodebaseFile(file: CodebaseFileRow): CodebaseFile {
  return {
    content: file.content,
    language: file.language,
    lineCount: file.content.split("\n").length,
    path: file.path,
  };
}

function formatCodebaseTemplate(
  row: CodebaseTemplateRow,
  files: CodebaseFilePreview[],
): CodebaseTemplateOption {
  return {
    description: row.description,
    files,
    id: row.id,
    slug: row.slug,
    technologies: row.technologies,
    technologyLabel: row.technologies
      .map((technology) => assessmentTechnologyLabels[technology])
      .join(" + "),
    title: row.title,
  };
}

async function getProfile() {
  if (!hasSupabaseConfig()) {
    return {
      data: null,
      error:
        "Supabase is not configured. Add the project URL and publishable key.",
    };
  }

  const supabase = await createClient();
  const { data: userResult, error: userError } = await supabase.auth.getUser();

  if (userError) {
    return { data: null, error: userError.message };
  }

  if (!userResult.user) {
    return { data: null, error: "Sign in to view dashboard data." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("recruiter_profiles")
    .select("full_name, organization_id")
    .eq("id", userResult.user.id)
    .maybeSingle();

  if (profileError) {
    return { data: null, error: profileError.message };
  }

  if (!profile) {
    return {
      data: null,
      error: "No active recruiter profile was found for this account.",
    };
  }

  return {
    data: {
      profile,
      supabase,
    },
    error: undefined,
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  const profileResult = await getProfile();

  if (!profileResult.data) {
    return emptyDashboardData(profileResult.error);
  }

  const { profile, supabase } = profileResult.data;

  const [assessmentsResult, candidatesResult] = await Promise.all([
    supabase
      .from("assessments")
      .select(
        "id, organization_id, title, role_name, status, time_limit_minutes, technologies, frontend_technology, backend_technology, job_description, codebase_template_id, rubric_source, rubric_text, candidate_access_code, due_at, completion_percent, median_score, created_by, created_at, updated_at",
      )
      .eq("organization_id", profile.organization_id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("candidates")
      .select(
        "id, organization_id, assessment_id, full_name, role_name, stage, score, risk, last_activity_at, created_at, updated_at",
      )
      .eq("organization_id", profile.organization_id)
      .order("updated_at", { ascending: false }),
  ]);

  if (assessmentsResult.error) {
    return emptyDashboardData(assessmentsResult.error.message);
  }

  if (candidatesResult.error) {
    return emptyDashboardData(candidatesResult.error.message);
  }

  const candidates = candidatesResult.data ?? [];
  const candidateCounts = countCandidatesByAssessment(candidates);

  return {
    assessments: (assessmentsResult.data ?? []).map((assessment) => ({
      ...formatAssessment(assessment),
      candidateCount: candidateCounts[assessment.id] ?? 0,
    })),
    candidates: candidates.map(formatCandidate),
    profile,
  };
}

export async function getAssessmentsData() {
  const dashboardData = await getDashboardData();

  return {
    assessments: dashboardData.assessments,
    error: dashboardData.error,
  };
}

export async function getCandidatesData() {
  const dashboardData = await getDashboardData();

  return {
    candidates: dashboardData.candidates,
    error: dashboardData.error,
  };
}

export async function getCreateAssessmentData(): Promise<CreateAssessmentData> {
  const profileResult = await getProfile();

  if (!profileResult.data) {
    return {
      error: profileResult.error,
      templates: [],
    };
  }

  const { supabase } = profileResult.data;

  const [templatesResult, filesResult] = await Promise.all([
    supabase
      .from("assessment_codebase_templates")
      .select(
        "id, slug, title, description, frontend_technology, backend_technology, technologies, is_active, created_at, updated_at",
      )
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
    supabase
      .from("assessment_codebase_files")
      .select(
        "id, codebase_template_id, path, language, content, sort_order, created_at, updated_at",
      )
      .order("sort_order", { ascending: true }),
  ]);

  if (templatesResult.error) {
    return {
      error: templatesResult.error.message,
      templates: [],
    };
  }

  if (filesResult.error) {
    return {
      error: filesResult.error.message,
      templates: [],
    };
  }

  const filesByTemplate = groupFilesByTemplate(filesResult.data ?? []);

  return {
    templates: (templatesResult.data ?? []).map((template) =>
      formatCodebaseTemplate(
        template,
        filesByTemplate[template.id] ?? [],
      ),
    ),
  };
}

export async function getAssessmentDetailsData(
  assessmentId: string,
): Promise<AssessmentDetailsData> {
  const profileResult = await getProfile();

  if (!profileResult.data) {
    return {
      assessment: null,
      codebaseFiles: [],
      error: profileResult.error,
    };
  }

  const { profile, supabase } = profileResult.data;

  const { data: assessment, error: assessmentError } = await supabase
    .from("assessments")
    .select(
      "id, organization_id, title, role_name, status, time_limit_minutes, technologies, frontend_technology, backend_technology, job_description, codebase_template_id, rubric_source, rubric_text, candidate_access_code, due_at, completion_percent, median_score, created_by, created_at, updated_at",
    )
    .eq("id", assessmentId)
    .eq("organization_id", profile.organization_id)
    .maybeSingle();

  if (assessmentError) {
    return {
      assessment: null,
      codebaseFiles: [],
      error: assessmentError.message,
    };
  }

  if (!assessment) {
    return {
      assessment: null,
      codebaseFiles: [],
      error: "Assessment not found.",
    };
  }

  if (!assessment.codebase_template_id) {
    return {
      assessment: formatAssessment(assessment),
      codebaseFiles: [],
    };
  }

  const { data: codebaseFiles, error: filesError } = await supabase
    .from("assessment_codebase_files")
    .select("id, codebase_template_id, path, language, content, sort_order, created_at, updated_at")
    .eq("codebase_template_id", assessment.codebase_template_id)
    .order("sort_order", { ascending: true });

  if (filesError) {
    return {
      assessment: formatAssessment(assessment),
      codebaseFiles: [],
      error: filesError.message,
    };
  }

  return {
    assessment: formatAssessment(assessment),
    codebaseFiles: (codebaseFiles ?? []).map(formatCodebaseFile),
  };
}
