"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import {
  getEvents,
  getInsights,
  getTimeline,
  listSessions,
  VOICE_API_BASE,
  type BackendSession,
  type SessionInsights,
  type TimelineEvent,
} from "@/lib/voiceAgent";

function statusClass(status: string) {
  if (status === "active") return "bg-[#d7ff5a] text-[#202322]";
  if (status === "processing") return "bg-[#202322] text-white";
  if (status.startsWith("error")) return "bg-[#ffe7df] text-[#80321d]";
  if (status === "done" || status === "complete") return "bg-[#e5e8df] text-[#4f564a]";
  return "bg-[#efeeeb] text-[#555a51]";
}

function formatTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function ms(value: number) {
  const total = Math.round(value);
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function InterviewSessionsPage() {
  const [sessions, setSessions] = useState<BackendSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<BackendSession | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [timeline, setTimeline] = useState<unknown>(null);
  const [insights, setInsights] = useState<SessionInsights | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listSessions();
      setSessions(data.sessions);
    } catch {
      setError(
        `Could not reach the voice-agent backend at ${VOICE_API_BASE}. Make sure it is running.`,
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time fetch on mount
    void refresh();
  }, [refresh]);

  const openSession = useCallback(async (session: BackendSession) => {
    setSelected(session);
    setDetailLoading(true);
    setDetailError(null);
    setEvents([]);
    setTimeline(null);
    setInsights(null);
    const [eventsResult, timelineResult, insightsResult] = await Promise.allSettled([
      getEvents(session.session_id),
      getTimeline(session.session_id),
      getInsights(session.session_id),
    ]);
    if (eventsResult.status === "fulfilled") {
      setEvents(eventsResult.value.events);
    }
    if (timelineResult.status === "fulfilled") {
      setTimeline(timelineResult.value.timeline);
    } else {
      setDetailError(
        "Timeline not ready yet — the session may still be processing.",
      );
    }
    if (insightsResult.status === "fulfilled") {
      setInsights(insightsResult.value.insights);
    }
    setDetailLoading(false);
  }, []);

  if (selected) {
    return (
      <>
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#353a32] transition hover:text-[#111510]"
        >
          <ArrowLeft size={16} /> Back to sessions
        </button>

        <header className="mt-3">
          <h1 className="text-[26px] font-black leading-tight text-[#202322]">
            {selected.candidate_name}
          </h1>
          <p className="mt-1 text-sm text-[#55594f]">
            {selected.problem_title} · started {formatTime(selected.started_at)}
          </p>
          <span
            className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-semibold ${statusClass(selected.status)}`}
          >
            {selected.status}
          </span>
        </header>

        {detailLoading ? (
          <p className="mt-6 text-sm text-[#62675e]">Loading analysis…</p>
        ) : null}

        {insights ? (
          <>
            {/* Summary + recommendation */}
            <section className="mt-6 rounded-[8px] border border-[#f0eeea] bg-white px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-bold text-[#202322]">AI Assessment</h2>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${insights.advance_recommend ? "bg-[#d7ff5a] text-[#202322]" : "bg-[#ffe7df] text-[#80321d]"}`}>
                  {insights.advance_recommend ? "Advance" : "Do not advance"}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-[#3d4239]">{insights.summary}</p>
              <p className="mt-1 text-xs text-[#62675e] italic">{insights.advance_reason}</p>

              <div className="mt-4 flex gap-6 text-sm text-[#55594f]">
                <span>Stuck <strong className="text-[#202322]">{insights.stuck_count}×</strong></span>
                <span>Hints <strong className="text-[#202322]">{insights.hint_count}×</strong></span>
                <span>Rubric stage <strong className="text-[#202322]">{insights.final_stage}</strong></span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[#62675e]">Strengths</p>
                  <ul className="space-y-1">
                    {insights.strengths.map((s, i) => (
                      <li key={i} className="rounded-full bg-[#edffd0] px-3 py-0.5 text-xs font-medium text-[#2d4a0a] inline-block mr-1 mb-1">{s}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[#62675e]">Gaps</p>
                  <ul className="space-y-1">
                    {insights.gaps.map((g, i) => (
                      <li key={i} className="rounded-full bg-[#ffe7df] px-3 py-0.5 text-xs font-medium text-[#80321d] inline-block mr-1 mb-1">{g}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            {/* Intent map */}
            {insights.intent_map.length > 0 ? (
              <section className="mt-4">
                <h2 className="text-base font-bold text-[#202322]">Interview map</h2>
                <div className="mt-3 relative">
                  {/* Timeline line */}
                  <div className="absolute left-[7px] top-0 bottom-0 w-[2px] bg-[#f0eeea]" />
                  <ul className="space-y-3 pl-6">
                    {insights.intent_map.map((moment, i) => {
                      const dotColor: Record<string, string> = {
                        stuck: "bg-[#ff6b4a]",
                        decision: "bg-[#d7ff5a]",
                        question: "bg-[#a8c5ff]",
                        answer: "bg-[#b8f0c8]",
                        explaining: "bg-[#e0d7ff]",
                        coding: "bg-[#ffd7a8]",
                        correction: "bg-[#ffa8d7]",
                      };
                      const color = dotColor[moment.category] ?? "bg-[#e0dedb]";
                      return (
                        <li key={i} className="relative flex gap-3 items-start">
                          <span className={`absolute -left-6 mt-1 h-3.5 w-3.5 rounded-full border-2 border-white ${color}`} />
                          <div>
                            <span className="text-xs font-semibold text-[#202322]">{moment.label}</span>
                            {moment.quote ? (
                              <p className="mt-0.5 text-xs text-[#62675e] leading-relaxed">"{moment.quote}"</p>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </section>
            ) : null}
          </>
        ) : null}

        <section className="mt-6">
          <h2 className="text-lg font-bold">Labeled moments</h2>
          {events.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {events.map((event, index) => (
                <li
                  key={index}
                  className="rounded-[8px] border border-[#f0eeea] bg-white px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-[#ebe9e6] px-2.5 py-0.5 text-xs font-semibold text-[#3c4138]">
                      {event.label || event.type}
                    </span>
                    <span className="font-mono text-xs text-[#7a7f76]">
                      {ms(event.t_start)} – {ms(event.t_end)}
                    </span>
                  </div>
                  {event.quote ? (
                    <p className="mt-2 text-sm leading-relaxed text-[#3d4239]">
                      “{event.quote}”
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-[#62675e]">
              {detailError ?? "No labeled events recorded for this session."}
            </p>
          )}
        </section>

        {timeline ? (
          <section className="mt-6">
            <h2 className="text-lg font-bold">Merged timeline</h2>
            <pre className="mt-3 max-h-[420px] overflow-auto rounded-[8px] border border-[#f0eeea] bg-[#fbfaf8] p-4 font-mono text-xs leading-relaxed text-[#3d4239]">
              {JSON.stringify(timeline, null, 2)}
            </pre>
          </section>
        ) : null}
      </>
    );
  }

  return (
    <>
      <section className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-black leading-tight text-[#202322]">
            Interviews
          </h1>
          <p className="mt-2 text-sm text-[#55594f]">
            Live voice-agent sessions from{" "}
            <span className="font-mono text-[13px]">{VOICE_API_BASE}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="inline-flex h-9 items-center gap-2 rounded-[3px] border border-[#dedbd5] px-3 text-[13px] font-bold text-[#202322] transition hover:bg-[#f3f1ee]"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : undefined} />
          Refresh
        </button>
      </section>

      {error ? (
        <p className="mt-4 rounded-[6px] border border-[#eadbd4] bg-[#fff8f5] px-4 py-3 text-sm text-[#7a3a27]">
          {error}
        </p>
      ) : null}

      <section className="mt-6 overflow-hidden rounded-[8px] border border-[#f0eeea] bg-white">
        {loading && sessions.length === 0 ? (
          <p className="px-4 py-8 text-sm text-[#62675e]">Loading sessions…</p>
        ) : sessions.length > 0 ? (
          sessions.map((session) => (
            <button
              type="button"
              key={session.session_id}
              onClick={() => openSession(session)}
              className="flex w-full items-center justify-between gap-4 border-b border-[#f0eeea] px-4 py-4 text-left transition last:border-b-0 hover:bg-[#faf9f7]"
            >
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-[#202322]">
                  {session.candidate_name}
                </p>
                <p className="mt-1 truncate text-sm text-[#62675e]">
                  {session.problem_title} · {formatTime(session.started_at)}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${statusClass(session.status)}`}
              >
                {session.status}
              </span>
            </button>
          ))
        ) : !error ? (
          <p className="px-4 py-8 text-sm text-[#62675e]">
            No interview sessions yet. Complete one from the candidate flow to see
            it here.
          </p>
        ) : null}
      </section>
    </>
  );
}
