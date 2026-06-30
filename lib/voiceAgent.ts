// Client for the Talkode voice-agent backend (FastAPI, default http://localhost:8000).
// CORS is open on the backend, so these run directly from the browser.

export const VOICE_API_BASE = (
  process.env.NEXT_PUBLIC_VOICE_API_URL?.trim() || "http://localhost:8000"
).replace(/\/$/, "");

export function voiceWsBase() {
  return VOICE_API_BASE.replace(/^http/, "ws");
}

export type CreateSessionBody = {
  candidate_name: string;
  problem_id: string;
  problem_title: string;
  problem_statement: string;
  question_guidelines: string;
  rubric_topics?: string[];
};

export type BackendSession = {
  session_id: string;
  candidate_name: string;
  problem_id: string;
  problem_title: string;
  problem_statement?: string;
  started_at: string;
  ended_at?: string | null;
  status: string;
};

// WebSocket messages the backend pushes to the browser.
export type InterviewServerMessage =
  | { type: "agent_intro"; text: string; timestamp_ms?: number }
  | { type: "agent_response"; text: string; timestamp_ms?: number }
  | { type: "agent_audio"; audio_b64: string }
  | { type: "transcript_chunk"; text: string; is_final?: boolean }
  | { type: "session_started"; text: string }
  | { type: "interview_complete" }
  | { type: "coding_challenge_ready" }
  | { type: "error"; text: string };

async function asJson<T>(res: Response, label: string): Promise<T> {
  if (!res.ok) {
    let detail = "";
    try {
      detail = JSON.stringify(await res.json());
    } catch {
      detail = await res.text().catch(() => "");
    }
    throw new Error(`${label} failed (${res.status}): ${detail}`);
  }
  return res.json() as Promise<T>;
}

export async function extractRubricTopics(
  rubricText: string,
): Promise<{ topics: string[] }> {
  const res = await fetch(`${VOICE_API_BASE}/rubric/extract-topics`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rubric_text: rubricText }),
  });
  return asJson(res, "extractRubricTopics");
}

export async function createSession(
  body: CreateSessionBody,
): Promise<{ session_id: string }> {
  const res = await fetch(`${VOICE_API_BASE}/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return asJson(res, "createSession");
}

export async function postSnapshot(
  sessionId: string,
  code: string,
  timestampMs?: number,
): Promise<{ stored: boolean; timestamp_ms?: number; reason?: string }> {
  const res = await fetch(`${VOICE_API_BASE}/snapshot/${sessionId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, timestamp_ms: timestampMs }),
  });
  return asJson(res, "postSnapshot");
}

export async function endSession(
  sessionId: string,
  audio: Blob,
): Promise<{ status: string; session_id: string }> {
  const form = new FormData();
  const ext = audio.type.includes("ogg") ? "ogg" : "webm";
  form.append("audio", audio, `session.${ext}`);
  const res = await fetch(`${VOICE_API_BASE}/session/${sessionId}/end`, {
    method: "POST",
    body: form,
  });
  return asJson(res, "endSession");
}

export async function uploadInterviewVideo(
  sessionId: string,
  video: Blob,
): Promise<{ stored: boolean }> {
  const form = new FormData();
  form.append("video", video, "session.webm");
  const res = await fetch(`${VOICE_API_BASE}/session/${sessionId}/video`, {
    method: "POST",
    body: form,
  });
  return asJson(res, "uploadInterviewVideo");
}

export async function getSessionVideo(
  sessionId: string,
): Promise<{ video_url: string | null }> {
  const res = await fetch(
    `${VOICE_API_BASE}/dashboard/session/${sessionId}/video`,
    { cache: "no-store" },
  );
  return asJson(res, "getSessionVideo");
}

export async function uploadInterviewScreenRecording(
  sessionId: string,
  video: Blob,
): Promise<{ stored: boolean }> {
  const form = new FormData();
  form.append("video", video, "screen.webm");
  const res = await fetch(`${VOICE_API_BASE}/session/${sessionId}/screen`, {
    method: "POST",
    body: form,
  });
  return asJson(res, "uploadInterviewScreenRecording");
}

export async function getSessionScreenRecording(
  sessionId: string,
): Promise<{ video_url: string | null }> {
  const res = await fetch(
    `${VOICE_API_BASE}/dashboard/session/${sessionId}/screen`,
    { cache: "no-store" },
  );
  return asJson(res, "getSessionScreenRecording");
}

export type ChallengeExample = {
  example_num: number;
  example_text: string;
  images: string[];
};

export type CodingChallenge = {
  frontend_id: string;
  title: string;
  difficulty: string;
  topics: string[];
  intro: string;
  description: string;
  examples: ChallengeExample[];
  constraints: string[];
  starter_code: Record<string, string>;
  default_language: string;
  // Reference editorial — only present on the recruiter-facing challenge
  // review endpoint, never sent to the candidate during the live interview.
  solution?: string;
};

export async function startCodingChallenge(
  sessionId: string,
): Promise<{
  problem: CodingChallenge;
  intro_text: string;
  intro_audio_b64: string | null;
}> {
  const res = await fetch(`${VOICE_API_BASE}/session/${sessionId}/challenge`, {
    method: "POST",
  });
  return asJson(res, "startCodingChallenge");
}

export async function submitCodingChallenge(
  sessionId: string,
  code: string,
  language: string,
): Promise<{ ack_text: string; ack_audio_b64: string | null }> {
  const res = await fetch(
    `${VOICE_API_BASE}/session/${sessionId}/challenge/submit`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, language }),
    },
  );
  return asJson(res, "submitCodingChallenge");
}

export type ChallengeGrade = {
  score: number;
  correct: boolean;
  time_complexity: string;
  feedback: string;
  title: string;
};

export async function getChallengeReview(
  sessionId: string,
): Promise<{
  problem: CodingChallenge | null;
  code: string | null;
  language: string | null;
  grade: ChallengeGrade | null;
}> {
  const res = await fetch(
    `${VOICE_API_BASE}/dashboard/session/${sessionId}/challenge`,
    { cache: "no-store" },
  );
  return asJson(res, "getChallengeReview");
}

export async function listSessions(): Promise<{ sessions: BackendSession[] }> {
  const res = await fetch(`${VOICE_API_BASE}/dashboard/sessions`, {
    cache: "no-store",
  });
  return asJson(res, "listSessions");
}

export type TranscriptTurn = {
  role: "agent" | "candidate";
  text: string;
  ts: number;
  intent?: string;
};

export async function getTranscript(
  sessionId: string,
): Promise<{ session_id: string; transcript: TranscriptTurn[] }> {
  const res = await fetch(
    `${VOICE_API_BASE}/dashboard/session/${sessionId}/transcript`,
    { cache: "no-store" },
  );
  return asJson(res, "getTranscript");
}

export type IntentMoment = {
  ts_ms: number;
  actor: "candidate" | "agent";
  category: "explaining" | "stuck" | "decision" | "question" | "answer" | "coding" | "correction";
  label: string;
  quote: string;
};

export type RubricScore = {
  question: string;
  score: number;
  reason: string;
};

export type SessionInsights = {
  summary: string;
  strengths: string[];
  gaps: string[];
  advance_recommend: boolean;
  advance_reason: string;
  rubric_scores: RubricScore[];
  stuck_count: number;
  hint_count: number;
  final_stage: number;
  intent_map: IntentMoment[];
  generated_at: number;
};

export async function getInsights(
  sessionId: string,
): Promise<{ session_id: string; insights: SessionInsights }> {
  const res = await fetch(
    `${VOICE_API_BASE}/dashboard/session/${sessionId}/insights`,
    { cache: "no-store" },
  );
  return asJson(res, "getInsights");
}
