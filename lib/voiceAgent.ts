// Client for the Chayote voice-agent backend (FastAPI, default http://localhost:8000).
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

export type TimelineEvent = {
  type:
    | "stuck"
    | "hint_request"
    | "decision"
    | "self_correction"
    | "arch_justification"
    | "agent_response"
    | string;
  t_start: number;
  t_end: number;
  quote: string;
  label: string;
};

// WebSocket messages the backend pushes to the browser.
export type InterviewServerMessage =
  | { type: "agent_intro"; text: string; timestamp_ms?: number }
  | { type: "agent_response"; text: string; timestamp_ms?: number }
  | { type: "agent_audio"; audio_b64: string }
  | { type: "transcript_chunk"; text: string; is_final?: boolean }
  | { type: "session_started"; text: string }
  | { type: "interview_complete" }
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

export async function listSessions(): Promise<{ sessions: BackendSession[] }> {
  const res = await fetch(`${VOICE_API_BASE}/dashboard/sessions`, {
    cache: "no-store",
  });
  return asJson(res, "listSessions");
}

export async function getEvents(
  sessionId: string,
): Promise<{ session_id: string; events: TimelineEvent[] }> {
  const res = await fetch(
    `${VOICE_API_BASE}/dashboard/session/${sessionId}/events`,
    { cache: "no-store" },
  );
  return asJson(res, "getEvents");
}

export async function getTimeline(
  sessionId: string,
): Promise<{ session_id: string; timeline: unknown }> {
  const res = await fetch(
    `${VOICE_API_BASE}/dashboard/session/${sessionId}/timeline`,
    { cache: "no-store" },
  );
  return asJson(res, "getTimeline");
}

export type IntentMoment = {
  ts_ms: number;
  actor: "candidate" | "agent";
  category: "explaining" | "stuck" | "decision" | "question" | "answer" | "coding" | "correction";
  label: string;
  quote: string;
};

export type SessionInsights = {
  summary: string;
  strengths: string[];
  gaps: string[];
  advance_recommend: boolean;
  advance_reason: string;
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
