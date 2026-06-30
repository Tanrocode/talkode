"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Bot,
  ChevronDown,
  Clock,
  Code2,
  Eye,
  File as FileIconDefault,
  FileCode,
  FileJson,
  FileText,
  Folder,
  Loader2,
  LogOut,
  MessageSquare,
  Mic,
  Moon,
  Plus,
  StickyNote,
  Sun,
  Trash2,
  VideoOff,
  X,
} from "lucide-react";
import { marked } from "marked";
import type { CandidateAssessmentSession } from "@/app/assessment/actions";
import type { CodebaseFile } from "@/app/dashboard/data";
import { useInterviewSession } from "@/app/assessment/useInterviewSession";
import { CodeEditor, type LineRange } from "@/app/assessment/CodeEditor";
import {
  startCodingChallenge,
  submitCodingChallenge,
  type CodingChallenge,
} from "@/lib/voiceAgent";


const TK_MONO =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

const THEME_STORAGE_KEY = "tk-theme";

const technologyLabels: Record<string, string> = {
  python: "Python",
  react_javascript: "React",
};

const workspaceCss = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
@keyframes tk-pulse-height { 0%, 100% { height: 4px; } 50% { height: 16px; } }
.tk-wf { animation: tk-pulse-height 1s ease-in-out infinite; }
.tk-wf:nth-child(2) { animation-delay: 0.2s; }
.tk-wf:nth-child(3) { animation-delay: 0.4s; }
.tk-wf:nth-child(4) { animation-delay: 0.6s; }
.tk-wf:nth-child(5) { animation-delay: 0.8s; }
.tk-scope {
  font-family: 'Inter', sans-serif;
  --tk-bg: #0d0e0f;
  --tk-bg-elevated: #1b1c1c;
  --tk-bg-panel: #121414;
  --tk-bg-sidebar: #1f2020;
  --tk-bg-hover: #292a2a;
  --tk-border: #444746;
  --tk-text: #e2e2e2;
  --tk-text-muted: #c4c7c5;
  --tk-text-dim: #8e918f;
  --tk-text-faint: #5a5f57;
  --tk-accent: #f5f5f4;
  --tk-accent-hover: #ffffff;
  --tk-accent-text-on: #0d0e0f;
  --tk-accent-text-soft: #e2e2e2;
  --tk-selection-bg: #3a3b3b;
  --tk-selection-text: #f5f5f4;
  --tk-danger: #ffb4ab;
  --tk-danger-text-soft: #ffdad6;
  --tk-danger-border: #93000a;
  --tk-warning: #e5c07b;
  --tk-rec-dot: #ff4d4d;
  --tk-speaking-bg: #343535;
  --tk-syntax-string: #e0af68;
}
.tk-scope[data-tk-theme="light"] {
  --tk-bg: #f7f7f5;
  --tk-bg-elevated: #ffffff;
  --tk-bg-panel: #f1f1ee;
  --tk-bg-sidebar: #ececea;
  --tk-bg-hover: #e2e2de;
  --tk-border: #d9d9d5;
  --tk-text: #1c1e1c;
  --tk-text-muted: #44473f;
  --tk-text-dim: #6c6f64;
  --tk-text-faint: #9a9d92;
  --tk-accent: #1c1e1c;
  --tk-accent-hover: #000000;
  --tk-accent-text-on: #ffffff;
  --tk-accent-text-soft: #1c1e1c;
  --tk-selection-bg: #d9d9d5;
  --tk-selection-text: #1c1e1c;
  --tk-danger: #b3261e;
  --tk-danger-text-soft: #7a160f;
  --tk-danger-border: #b3261e;
  --tk-warning: #92660a;
  --tk-rec-dot: #d92d20;
  --tk-speaking-bg: #ffffff;
  --tk-syntax-string: #b45309;
}
.tk-mono { font-family: ${TK_MONO}; }
.tk-scope ::-webkit-scrollbar { width: 8px; height: 8px; }
.tk-scope ::-webkit-scrollbar-track { background: transparent; }
.tk-scope ::-webkit-scrollbar-thumb { background: var(--tk-border); border-radius: 4px; }
.tk-scope ::-webkit-scrollbar-thumb:hover { background: var(--tk-text-dim); }
.tk-scope .token.comment { color: var(--tk-text-faint); }
.tk-scope .token.keyword,
.tk-scope .token.tag { color: #c792ea; }
.tk-scope .token.string,
.tk-scope .token.attr-value { color: var(--tk-syntax-string); }
.tk-scope .token.function { color: #82aaff; }
.tk-scope .token.number,
.tk-scope .token.boolean { color: #f78c6c; }
.tk-scope .token.punctuation { color: var(--tk-text-dim); }
.tk-scope .token.class-name,
.tk-scope .token.builtin { color: #ffcb6b; }
.tk-scope .token.operator { color: var(--tk-text-muted); }
.tk-markdown { line-height: 1.7; }
.tk-markdown h1 { font-size: 1.5rem; font-weight: 800; margin: 0.6em 0 0.4em; }
.tk-markdown h2 { font-size: 1.25rem; font-weight: 700; margin: 0.6em 0 0.4em; }
.tk-markdown h3 { font-size: 1.1rem; font-weight: 700; margin: 0.5em 0 0.3em; }
.tk-markdown p { margin: 0.5em 0; }
.tk-markdown ul, .tk-markdown ol { margin: 0.4em 0 0.4em 1.4em; }
.tk-markdown li { margin: 0.2em 0; }
.tk-markdown a { color: var(--tk-accent); text-decoration: underline; }
.tk-markdown code { font-family: ${TK_MONO}; background: var(--tk-bg-hover); padding: 0.1em 0.35em; border-radius: 4px; font-size: 0.85em; }
.tk-markdown pre { background: var(--tk-bg-hover); padding: 0.75em 1em; border-radius: 6px; overflow-x: auto; margin: 0.6em 0; }
.tk-markdown pre code { background: none; padding: 0; }
.tk-markdown blockquote { border-left: 3px solid var(--tk-border); padding-left: 0.8em; color: var(--tk-text-dim); margin: 0.5em 0; }
.tk-markdown hr { border-color: var(--tk-border); margin: 1em 0; }
.tk-markdown table { border-collapse: collapse; margin: 0.6em 0; }
.tk-markdown th, .tk-markdown td { border: 1px solid var(--tk-border); padding: 0.3em 0.6em; }
`;

type TreeNode = {
  name: string;
  path: string;
  isDir: boolean;
  children: TreeNode[];
};

type Note = {
  id: string;
  filePath: string;
  startLine: number;
  endLine: number;
  text: string;
  createdAt: number;
};

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function buildFileTree(files: CodebaseFile[]): TreeNode[] {
  const root: TreeNode = { name: "", path: "", isDir: true, children: [] };

  for (const file of files) {
    const segments = file.path.split("/").filter(Boolean);
    let node = root;

    segments.forEach((segment, index) => {
      const isLeaf = index === segments.length - 1;
      const segmentPath = segments.slice(0, index + 1).join("/");
      let child = node.children.find(
        (candidate) => candidate.name === segment && candidate.isDir === !isLeaf,
      );

      if (!child) {
        child = { name: segment, path: segmentPath, isDir: !isLeaf, children: [] };
        node.children.push(child);
      }

      node = child;
    });
  }

  const sortNodes = (node: TreeNode) => {
    node.children.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    node.children.forEach(sortNodes);
  };

  sortNodes(root);
  return root.children;
}

function FileGlyph({ name, className }: { name: string; className?: string }) {
  if (name.endsWith(".json"))
    return <FileJson className={cx(className, "text-[#eab308]")} />;
  if (name.endsWith(".py"))
    return <FileCode className={cx(className, "text-[#4b8bbe]")} />;
  if (name.endsWith(".ts") || name.endsWith(".tsx"))
    return <FileCode className={cx(className, "text-[#3b82f6]")} />;
  if (name.endsWith(".js") || name.endsWith(".jsx"))
    return <FileCode className={cx(className, "text-[#facc15]")} />;
  if (name.endsWith(".css"))
    return <FileCode className={cx(className, "text-[#06b6d4]")} />;
  if (name.endsWith(".md") || name.endsWith(".txt"))
    return <FileText className={cx(className, "text-[var(--tk-text-dim)]")} />;
  return <FileIconDefault className={cx(className, "text-[var(--tk-text-dim)]")} />;
}

function initialSeconds(session: CandidateAssessmentSession) {
  const cap = Math.max(0, session.timeLimitMinutes * 60);
  if (session.expiresAt) {
    const ms = new Date(session.expiresAt).getTime() - Date.now();
    if (!Number.isNaN(ms)) return Math.min(cap, Math.max(0, Math.floor(ms / 1000)));
  }
  return cap;
}

function formatClock(total: number) {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function buildProblemStatement(session: CandidateAssessmentSession) {
  const techs = session.technologies
    .map((tech) => technologyLabels[tech] ?? tech)
    .join(", ");
  const files = session.codeFiles.map((file) => `- ${file.path}`).join("\n");
  return [
    `This is a ${techs || "code"} walkthrough interview for "${session.title}".`,
    "",
    "The candidate has this codebase open:",
    files || "(no files provided)",
    "",
    "Ask them to walk through the code, explain key decisions, spot issues, and",
    "propose improvements. Probe their reasoning when they pause.",
  ].join("\n");
}

function getInitialTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  return window.localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
}

function notesStorageKey(key: string) {
  return `tk-notes:${key}`;
}

function loadNotes(key: string): Note[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(notesStorageKey(key));
    return raw ? (JSON.parse(raw) as Note[]) : [];
  } catch {
    return [];
  }
}

function SelfCameraPreview({
  stream,
  panelOpen,
}: {
  stream: MediaStream | null;
  panelOpen: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (videoEl) videoEl.srcObject = stream;
  }, [stream]);

  return (
    <div
      className={cx(
        "absolute bottom-4 z-40 h-28 w-40 overflow-hidden rounded-xl border-2 border-[var(--tk-border)] bg-[var(--tk-bg-elevated)] shadow-lg transition-[right]",
        panelOpen ? "right-[25rem]" : "right-4",
      )}
    >
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="h-full w-full -scale-x-100 object-cover"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-[var(--tk-text-dim)]">
          <VideoOff className="h-5 w-5" />
          <span className="text-[10px]">Camera unavailable</span>
        </div>
      )}
      {stream ? (
        <div className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded bg-black/50 px-1.5 py-0.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--tk-rec-dot)]" />
          <span className="text-[10px] font-semibold tracking-wide text-white">
            REC
          </span>
        </div>
      ) : null}
    </div>
  );
}

function difficultyBadgeClass(difficulty: string): string {
  if (difficulty === "Easy") return "bg-emerald-500/15 text-emerald-400";
  if (difficulty === "Medium") return "bg-amber-500/15 text-amber-400";
  if (difficulty === "Hard") return "bg-rose-500/15 text-rose-400";
  return "bg-[var(--tk-bg-hover)] text-[var(--tk-text-dim)]";
}

const CHALLENGE_LANGUAGE_LABELS: Record<string, string> = {
  python: "Python",
  javascript: "JavaScript",
  typescript: "TypeScript",
  java: "Java",
  cpp: "C++",
  csharp: "C#",
  go: "Go",
  rust: "Rust",
  php: "PHP",
  ruby: "Ruby",
};

function CodingChallengePanel({
  open,
  problem,
  code,
  language,
  onCodeChange,
  onLanguageChange,
  onSubmit,
  submitting,
}: {
  open: boolean;
  problem: CodingChallenge | null;
  code: string;
  language: string;
  onCodeChange: (value: string) => void;
  onLanguageChange: (language: string) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const availableLanguages = problem ? Object.keys(problem.starter_code) : [];

  return (
    <div
      className={cx(
        "absolute inset-0 z-30 flex flex-col bg-[var(--tk-bg)] transition-transform duration-300 ease-out",
        open ? "translate-x-0" : "translate-x-full",
      )}
    >
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--tk-border)] bg-[var(--tk-bg-elevated)] px-3">
        <div className="flex items-center gap-2">
          <Code2 className="h-3.5 w-3.5 text-[var(--tk-accent)]" />
          <span className="text-xs font-semibold uppercase tracking-widest text-[var(--tk-text-muted)]">
            Coding challenge
          </span>
          {problem ? (
            <span className={cx("tk-mono rounded px-2 py-0.5 text-[11px] font-semibold", difficultyBadgeClass(problem.difficulty))}>
              {problem.difficulty}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {availableLanguages.length > 0 ? (
            <select
              value={language}
              onChange={(event) => onLanguageChange(event.target.value)}
              className="tk-mono rounded border border-[var(--tk-border)] bg-[var(--tk-bg)] px-2 py-1 text-xs text-[var(--tk-text)] outline-none"
            >
              {availableLanguages.map((lang) => (
                <option key={lang} value={lang}>
                  {CHALLENGE_LANGUAGE_LABELS[lang] ?? lang}
                </option>
              ))}
            </select>
          ) : null}
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting || !problem}
            className="rounded-md bg-[var(--tk-accent)] px-3 py-1 text-xs font-semibold text-[var(--tk-accent-text-on)] transition-colors hover:bg-[var(--tk-accent-hover)] disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit & return to codebase"}
          </button>
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="w-[400px] shrink-0 overflow-y-auto border-r border-[var(--tk-border)] p-5 text-sm">
          {problem ? (
            <>
              <h2 className="text-lg font-bold text-[var(--tk-text)]">{problem.title}</h2>
              <p className="mt-2 text-[var(--tk-text-muted)]">{problem.intro}</p>
              <p className="mt-4 whitespace-pre-wrap leading-relaxed text-[var(--tk-text-muted)]">
                {problem.description}
              </p>
              {problem.examples.map((example) => (
                <pre
                  key={example.example_num}
                  className="tk-mono mt-4 whitespace-pre-wrap rounded border border-[var(--tk-border)] bg-[var(--tk-bg-elevated)] p-3 text-xs text-[var(--tk-text-muted)]"
                >
                  {example.example_text}
                </pre>
              ))}
              {problem.constraints.length > 0 ? (
                <>
                  <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--tk-text-dim)]">
                    Constraints
                  </h3>
                  <ul className="tk-mono mt-1 list-disc space-y-0.5 pl-4 text-xs text-[var(--tk-text-muted)]">
                    {problem.constraints.map((constraint, index) => (
                      <li key={index}>{constraint}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </>
          ) : (
            <p className="flex items-center gap-2 text-[var(--tk-text-dim)]">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading challenge…
            </p>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <CodeEditor
            value={code}
            onChange={onCodeChange}
            filePath="challenge"
            language={language}
            autoFocus={open}
          />
        </div>
      </div>
    </div>
  );
}

export function InterviewWorkspace({
  session,
}: {
  session: CandidateAssessmentSession;
}) {
  const files = session.codeFiles;
  const tree = useMemo(() => buildFileTree(files), [files]);
  const notesKey = `${session.assessmentId}:${session.candidateName}`;

  const [activePath, setActivePath] = useState(files[0]?.path ?? "");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [openDirs, setOpenDirs] = useState<Set<string>>(() => {
    const open = new Set<string>();
    const walk = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        if (node.isDir) {
          open.add(node.path);
          walk(node.children);
        }
      }
    };
    walk(tree);
    return open;
  });
  const [panelOpen, setPanelOpen] = useState(true);
  const [rightTab, setRightTab] = useState<"interview" | "notes">("interview");
  const [secondsLeft, setSecondsLeft] = useState(() => initialSeconds(session));
  const [theme, setTheme] = useState<"dark" | "light">(() => getInitialTheme());
  const [notes, setNotes] = useState<Note[]>(() => loadNotes(notesKey));
  const [selectionRange, setSelectionRange] = useState<LineRange | null>(null);
  const [jumpTarget, setJumpTarget] = useState<LineRange | null>(null);
  const [draftNote, setDraftNote] = useState("");
  const [markdownPreview, setMarkdownPreview] = useState(true);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [challengeProblem, setChallengeProblem] = useState<CodingChallenge | null>(null);
  const [challengeCode, setChallengeCode] = useState("");
  const [challengeLanguage, setChallengeLanguage] = useState("python");
  const [challengeSubmitting, setChallengeSubmitting] = useState(false);
  const challengeTriggeredRef = useRef(false);

  useEffect(() => {
    window.localStorage.setItem(notesStorageKey(notesKey), JSON.stringify(notes));
  }, [notes, notesKey]);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const {
    status,
    messages,
    interim,
    error,
    sessionId,
    speaking,
    interviewComplete,
    challengeReady,
    cameraStream,
    start,
    end,
    announceAgentText,
  } = useInterviewSession();

  // Auto-end when agent signals all rubric areas are covered
  useEffect(() => {
    if (interviewComplete && status === "live") {
      void end();
    }
  }, [interviewComplete, status, end]);

  const sessionIdRef = useRef<string | null>(null);
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const triggerChallenge = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    try {
      const { problem, intro_text, intro_audio_b64 } = await startCodingChallenge(sid);
      const lang = problem.default_language in problem.starter_code
        ? problem.default_language
        : Object.keys(problem.starter_code)[0] ?? "python";
      setChallengeProblem(problem);
      setChallengeLanguage(lang);
      setChallengeCode(problem.starter_code[lang] ?? "");
      setChallengeOpen(true);
      announceAgentText(intro_text, intro_audio_b64);
    } catch (caught) {
      console.warn("Failed to start coding challenge", caught);
    }
  }, [announceAgentText]);

  const handleChallengeLanguageChange = useCallback(
    (lang: string) => {
      setChallengeLanguage(lang);
      setChallengeCode(challengeProblem?.starter_code[lang] ?? "");
    },
    [challengeProblem],
  );

  // The backend decides when a topic has closed and the candidate has shown
  // enough understanding (see should_trigger_challenge in agent.py), then
  // pushes coding_challenge_ready over the interview WebSocket. Wait for the
  // interviewer to finish speaking the closing line for that turn first —
  // otherwise the challenge intro's audio plays on top of it.
  useEffect(() => {
    if (!challengeReady || challengeTriggeredRef.current || speaking) return;
    challengeTriggeredRef.current = true;
    void triggerChallenge();
  }, [challengeReady, speaking, triggerChallenge]);

  const handleChallengeSubmit = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    setChallengeSubmitting(true);
    try {
      const { ack_text, ack_audio_b64 } = await submitCodingChallenge(
        sid,
        challengeCode,
        challengeLanguage,
      );
      setChallengeOpen(false);
      announceAgentText(ack_text, ack_audio_b64);
    } catch (caught) {
      console.warn("Failed to submit coding challenge", caught);
    } finally {
      setChallengeSubmitting(false);
    }
  }, [challengeCode, challengeLanguage, announceAgentText]);

  const activeFile = files.find((file) => file.path === activePath) ?? files[0] ?? null;
  const activeName = activeFile ? activeFile.path.split("/").pop() : "";
  const activeContent = activeFile
    ? edits[activeFile.path] ?? activeFile.content
    : "";
  const isMarkdownFile = activeFile ? activeFile.path.endsWith(".md") : false;
  const markdownHtml = useMemo(
    () => (isMarkdownFile ? (marked.parse(activeContent) as string) : ""),
    [isMarkdownFile, activeContent],
  );

  // Always expose the latest code to the snapshot loop — the agent reads
  // this for live Q&A context. While the coding-challenge panel is open,
  // surface the challenge's problem + the candidate's in-progress solution
  // instead, so a question asked mid-challenge is answered about the
  // challenge rather than the (now hidden) main codebase.
  const codeRef = useRef("");
  useEffect(() => {
    if (challengeOpen && challengeProblem) {
      codeRef.current = [
        `// MID-INTERVIEW CODING CHALLENGE: ${challengeProblem.title}`,
        `// ${challengeProblem.intro}`,
        `// Problem: ${challengeProblem.description}`,
        `// Language: ${challengeLanguage}`,
        "",
        challengeCode,
      ].join("\n");
      return;
    }
    codeRef.current = activeFile
      ? `// File: ${activeFile.path}\n${activeContent}`
      : "";
  }, [activeFile, activeContent, challengeOpen, challengeProblem, challengeCode, challengeLanguage]);

  // Start the interview once when the workspace mounts.
  const startArgsRef = useRef({
    candidate_name: session.candidateName,
    problem_id: session.assessmentId,
    problem_title: session.title,
    problem_statement: buildProblemStatement(session),
    question_guidelines: session.rubric,
    rubric_topics: session.rubricTopics,
  });
  useEffect(() => {
    void start({ ...startArgsRef.current, getCode: () => codeRef.current });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown timer, driven by the database-anchored expiry on `session`.
  useEffect(() => {
    const id = setInterval(() => {
      setSecondsLeft(initialSeconds(session));
    }, 1000);
    return () => clearInterval(id);
  }, [session]);

  // Auto-scroll the interview feed.
  const feedRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
  }, [messages, interim]);

  function toggleDir(path: string) {
    setOpenDirs((previous) => {
      const next = new Set(previous);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function toggleTheme() {
    setTheme((value) => (value === "dark" ? "light" : "dark"));
  }

  function addNote() {
    if (!activeFile || !selectionRange || !draftNote.trim()) return;
    const note: Note = {
      id: crypto.randomUUID(),
      filePath: activeFile.path,
      startLine: selectionRange.startLine,
      endLine: selectionRange.endLine,
      text: draftNote.trim(),
      createdAt: Date.now(),
    };
    setNotes((previous) => [note, ...previous]);
    setDraftNote("");
    setSelectionRange(null);
  }

  function deleteNote(id: string) {
    setNotes((previous) => previous.filter((note) => note.id !== id));
  }

  function openNote(note: Note) {
    setActivePath(note.filePath);
    setJumpTarget({ startLine: note.startLine, endLine: note.endLine });
    setPanelOpen(true);
    setRightTab("notes");
  }

  async function handleEnd() {
    if (status === "ending" || status === "ended") return;
    if (!window.confirm("End the assessment and submit for review?")) return;
    await end();
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }

  const live = status === "live";
  const dotColor =
    status === "live"
      ? "bg-[var(--tk-accent)]"
      : status === "error"
        ? "bg-[var(--tk-danger)]"
        : "bg-[var(--tk-warning)]";
  const statusLabel =
    status === "live"
      ? "Recording"
      : status === "connecting"
        ? "Connecting"
        : status === "ending"
          ? "Submitting"
          : status === "ended"
            ? "Submitted"
            : status === "error"
              ? "Connection error"
              : "Idle";

  const renderNodes = (nodes: TreeNode[], depth: number): ReactNode =>
    nodes.map((node) => {
      const indent = { paddingLeft: depth * 14 + 8 };

      if (node.isDir) {
        const open = openDirs.has(node.path);
        return (
          <div key={node.path}>
            <button
              type="button"
              onClick={() => toggleDir(node.path)}
              style={indent}
              className="group flex w-full items-center space-x-2 rounded px-2 py-1 text-left text-[var(--tk-text-muted)] transition-colors hover:bg-[var(--tk-bg-hover)]"
            >
              <ChevronDown
                className={cx(
                  "h-4 w-4 shrink-0 text-[var(--tk-text-dim)] transition-transform group-hover:text-[var(--tk-text-muted)]",
                  !open && "-rotate-90",
                )}
              />
              <Folder className="h-4 w-4 shrink-0 text-[var(--tk-text-dim)]" />
              <span className="truncate">{node.name}</span>
            </button>
            {open ? renderNodes(node.children, depth + 1) : null}
          </div>
        );
      }

      const active = node.path === activePath;
      return (
        <button
          type="button"
          key={node.path}
          onClick={() => setActivePath(node.path)}
          style={indent}
          className={cx(
            "relative flex w-full items-center space-x-2 rounded px-2 py-1 text-left transition-colors",
            active
              ? "bg-[var(--tk-accent)]/10 text-[var(--tk-accent)] before:absolute before:left-0 before:top-0 before:h-full before:w-[2px] before:bg-[var(--tk-accent)] before:content-['']"
              : "text-[var(--tk-text-muted)] hover:bg-[var(--tk-bg-hover)] hover:text-[var(--tk-text)]",
          )}
        >
          <FileGlyph name={node.name} className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{node.name}</span>
        </button>
      );
    });

  return (
    <div
      data-tk-theme={theme}
      className="tk-scope fixed inset-0 flex flex-col overflow-hidden bg-[var(--tk-bg)] text-[var(--tk-text)] selection:bg-[var(--tk-selection-bg)] selection:text-[var(--tk-selection-text)]"
    >
      <style>{workspaceCss}</style>

      {/* AI Speaking Indicator */}
      <div className="absolute top-4 left-1/2 z-50 flex -translate-x-1/2 items-center space-x-3 rounded-full border border-[var(--tk-border)] bg-[var(--tk-speaking-bg)] px-4 py-2 shadow-lg">
        <div className="flex items-center space-x-2">
          <div className={cx("h-2 w-2 rounded-full", speaking ? "bg-[var(--tk-accent)] animate-pulse" : dotColor)} />
          <span className="text-xs font-medium uppercase tracking-wide text-[var(--tk-text)]">
            {speaking ? "AI Speaking" : "AI Interviewer"}
          </span>
        </div>
        <div className="flex h-4 items-center space-x-1">
          {[8, 12, 16, 10, 6].map((height, index) => (
            <div
              key={index}
              className={cx("w-1 rounded-full bg-[var(--tk-accent)]", speaking && "tk-wf")}
              style={{ height: speaking ? `${height}px` : "4px" }}
            />
          ))}
        </div>
      </div>

      <SelfCameraPreview stream={cameraStream} panelOpen={panelOpen} />

      {/* Main Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-[var(--tk-border)] bg-[var(--tk-bg-panel)] px-5 py-2">
        <div className="flex min-w-0 items-center space-x-3">
          <div className="text-base font-bold tracking-tight text-[var(--tk-text)]">talkode</div>
          <div className="h-3.5 w-px bg-[var(--tk-border)]" />
          <div className="truncate text-[11px] font-medium uppercase tracking-widest text-[var(--tk-text-muted)]">
            {session.title}
          </div>
        </div>
        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="flex items-center justify-center rounded-md border border-[var(--tk-border)] bg-[var(--tk-bg-elevated)] p-1.5 text-[var(--tk-text-muted)] transition-colors hover:text-[var(--tk-text)]"
          >
            {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
          <div className="flex items-center space-x-1.5 rounded-md border border-[var(--tk-border)] bg-[var(--tk-bg-elevated)] px-2.5 py-1">
            <Clock className="h-3.5 w-3.5 text-[var(--tk-text-muted)]" />
            <span className="tk-mono text-xs font-semibold text-[var(--tk-text)]">
              {formatClock(secondsLeft)}
            </span>
          </div>
          <button
            type="button"
            onClick={handleEnd}
            disabled={status === "ending" || status === "ended"}
            className="flex items-center space-x-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-[var(--tk-danger)] transition-colors hover:bg-[var(--tk-danger-border)]/10 hover:text-[var(--tk-danger-text-soft)] disabled:opacity-50"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>End session</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex flex-1 overflow-hidden">
        {/* File Explorer Sidebar */}
        <aside className="flex w-64 shrink-0 flex-col border-r border-[var(--tk-border)] bg-[var(--tk-bg-sidebar)]">
          <div className="flex flex-col gap-1 border-b border-[var(--tk-border)] p-4">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[var(--tk-text-muted)]">
              <span>Codebase</span>
              <Folder className="h-4 w-4" />
            </div>
            <span className="truncate text-[11px] text-[var(--tk-text-faint)]">
              {session.title}
            </span>
          </div>
          <div className="tk-mono flex-1 overflow-y-auto p-2 text-sm">
            {files.length > 0 ? (
              renderNodes(tree, 0)
            ) : (
              <p className="px-2 py-2 text-[var(--tk-text-dim)]">No files loaded.</p>
            )}
          </div>
        </aside>

        {/* Code Editor */}
        <section className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--tk-bg)]">
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--tk-border)] bg-[var(--tk-bg-elevated)] px-3">
            <div className="flex h-full items-center">
              <div className="tk-mono flex h-full items-center border-b-2 border-[var(--tk-accent)] bg-[var(--tk-bg)] px-3 text-xs text-[var(--tk-accent)]">
                {activeName || "No file"}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {isMarkdownFile ? (
                <div className="flex items-center rounded border border-[var(--tk-border)] p-0.5">
                  <button
                    type="button"
                    onClick={() => setMarkdownPreview(false)}
                    className={cx(
                      "flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold transition-colors",
                      !markdownPreview
                        ? "bg-[var(--tk-bg-hover)] text-[var(--tk-text)]"
                        : "text-[var(--tk-text-dim)] hover:text-[var(--tk-text-muted)]",
                    )}
                  >
                    <Code2 className="h-3 w-3" /> Code
                  </button>
                  <button
                    type="button"
                    onClick={() => setMarkdownPreview(true)}
                    className={cx(
                      "flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold transition-colors",
                      markdownPreview
                        ? "bg-[var(--tk-bg-hover)] text-[var(--tk-text)]"
                        : "text-[var(--tk-text-dim)] hover:text-[var(--tk-text-muted)]",
                    )}
                  >
                    <Eye className="h-3 w-3" /> Preview
                  </button>
                </div>
              ) : null}
              {selectionRange ? (
                <button
                  type="button"
                  onClick={() => {
                    setPanelOpen(true);
                    setRightTab("notes");
                  }}
                  className="flex items-center gap-1.5 rounded border border-[var(--tk-accent)]/40 px-2 py-0.5 text-[11px] font-semibold text-[var(--tk-accent)] transition-colors hover:bg-[var(--tk-accent)]/10"
                >
                  <Plus className="h-3 w-3" />
                  <span>
                    Note (lines {selectionRange.startLine}
                    {selectionRange.endLine !== selectionRange.startLine
                      ? `-${selectionRange.endLine}`
                      : ""}
                    )
                  </span>
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setPanelOpen((value) => !value)}
                className={cx(
                  "flex items-center space-x-1.5 rounded border px-2 py-0.5 text-[11px] font-semibold transition-colors",
                  panelOpen
                    ? "border-[var(--tk-accent)] bg-[var(--tk-accent)]/10 text-[var(--tk-accent)]"
                    : "border-[var(--tk-accent)]/30 text-[var(--tk-accent)] hover:bg-[var(--tk-accent)]/10",
                )}
              >
                <MessageSquare className="h-3 w-3" />
                <span>Toggle panel</span>
              </button>
            </div>
          </div>
          {activeFile && isMarkdownFile && markdownPreview ? (
            <div
              className="tk-markdown flex-1 overflow-y-auto p-6 text-[15px] text-[var(--tk-text)]"
              dangerouslySetInnerHTML={{ __html: markdownHtml }}
            />
          ) : activeFile ? (
            <CodeEditor
              value={activeContent}
              onChange={(value) =>
                setEdits((prev) => ({
                  ...prev,
                  [activeFile.path]: value,
                }))
              }
              filePath={activeFile.path}
              highlightRange={jumpTarget}
              onSelectionLinesChange={setSelectionRange}
            />
          ) : (
            <div className="tk-mono flex-1 p-6 text-sm text-[var(--tk-text-dim)]">
              No file selected.
            </div>
          )}

          <CodingChallengePanel
            open={challengeOpen}
            problem={challengeProblem}
            code={challengeCode}
            language={challengeLanguage}
            onCodeChange={setChallengeCode}
            onLanguageChange={handleChallengeLanguageChange}
            onSubmit={handleChallengeSubmit}
            submitting={challengeSubmitting}
          />
        </section>

        {/* Right Sidebar: Interview / Notes */}
        {panelOpen ? (
          <aside className="flex w-96 shrink-0 flex-col border-l border-[var(--tk-border)] bg-[var(--tk-bg-panel)]">
            <div className="flex items-center justify-between border-b border-[var(--tk-border)] px-2 py-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setRightTab("interview")}
                  className={cx(
                    "flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors",
                    rightTab === "interview"
                      ? "bg-[var(--tk-bg-hover)] text-[var(--tk-text)]"
                      : "text-[var(--tk-text-dim)] hover:text-[var(--tk-text-muted)]",
                  )}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Interview
                </button>
                <button
                  type="button"
                  onClick={() => setRightTab("notes")}
                  className={cx(
                    "flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors",
                    rightTab === "notes"
                      ? "bg-[var(--tk-bg-hover)] text-[var(--tk-text)]"
                      : "text-[var(--tk-text-dim)] hover:text-[var(--tk-text-muted)]",
                  )}
                >
                  <StickyNote className="h-3.5 w-3.5" />
                  Notes{notes.length > 0 ? ` (${notes.length})` : ""}
                </button>
              </div>
              <div className="flex items-center gap-2 pr-1">
                {rightTab === "interview" ? (
                  <span
                    className={cx(
                      "flex items-center gap-1.5 text-xs font-medium",
                      status === "error" ? "text-[var(--tk-danger)]" : "text-[var(--tk-text-dim)]",
                    )}
                  >
                    <span className={cx("h-1.5 w-1.5 rounded-full", dotColor)} />
                    {statusLabel}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => setPanelOpen(false)}
                  className="text-[var(--tk-text-dim)] transition-colors hover:text-[var(--tk-text)]"
                  aria-label="Close panel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {rightTab === "interview" ? (
              <>
                <div ref={feedRef} className="flex-1 space-y-3 overflow-y-auto p-4">
                  {messages.length === 0 && status === "connecting" ? (
                    <p className="flex items-center gap-2 text-sm text-[var(--tk-text-dim)]">
                      <Loader2 className="h-4 w-4 animate-spin" /> Connecting to the
                      interviewer…
                    </p>
                  ) : null}

                  {messages.map((message) =>
                    message.role === "agent" ? (
                      <div key={message.id} className="flex gap-2">
                        <Bot className="mt-0.5 h-4 w-4 shrink-0 text-[var(--tk-accent)]" />
                        <div className="rounded-lg rounded-tl-none border border-[var(--tk-border)] bg-[var(--tk-bg-elevated)] px-3 py-2 text-sm leading-relaxed text-[var(--tk-text)] whitespace-pre-wrap">
                          {message.text}
                        </div>
                      </div>
                    ) : (
                      <div key={message.id} className="flex justify-end gap-2">
                        <div className="rounded-lg rounded-tr-none bg-[var(--tk-accent)]/10 px-3 py-2 text-sm leading-relaxed text-[var(--tk-accent-text-soft)] whitespace-pre-wrap">
                          {message.text}
                        </div>
                        <Mic className="mt-0.5 h-4 w-4 shrink-0 text-[var(--tk-text-dim)]" />
                      </div>
                    ),
                  )}

                  {interim ? (
                    <div className="flex justify-end gap-2">
                      <div className="rounded-lg rounded-tr-none border border-dashed border-[var(--tk-border)] px-3 py-2 text-sm italic text-[var(--tk-text-dim)]">
                        {interim}
                      </div>
                    </div>
                  ) : null}
                </div>

                {error ? (
                  <div className="border-t border-[var(--tk-danger-border)]/40 bg-[var(--tk-danger-border)]/10 px-4 py-2 text-xs text-[var(--tk-danger)]">
                    {error}
                  </div>
                ) : null}

                <div className="border-t border-[var(--tk-border)] px-4 py-2 text-[11px] text-[var(--tk-text-faint)]">
                  {sessionId ? `Session ${sessionId.slice(0, 8)} · ` : ""}Speak
                  naturally — the interviewer responds when you pause.
                </div>
              </>
            ) : (
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {selectionRange && activeFile ? (
                  <div className="rounded-lg border border-[var(--tk-border)] bg-[var(--tk-bg-elevated)] p-3">
                    <div className="mb-2 text-xs font-semibold text-[var(--tk-accent)]">
                      + Note (lines {selectionRange.startLine}
                      {selectionRange.endLine !== selectionRange.startLine
                        ? `-${selectionRange.endLine}`
                        : ""}
                      )
                    </div>
                    <textarea
                      value={draftNote}
                      onChange={(event) => setDraftNote(event.target.value)}
                      placeholder="What do you want to remember about this?"
                      rows={3}
                      className="tk-mono w-full resize-none rounded border border-[var(--tk-border)] bg-[var(--tk-bg)] p-2 text-xs text-[var(--tk-text)] outline-none"
                    />
                    <div className="mt-2 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectionRange(null);
                          setDraftNote("");
                        }}
                        className="text-xs text-[var(--tk-text-dim)] hover:text-[var(--tk-text-muted)]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={addNote}
                        disabled={!draftNote.trim()}
                        className="rounded bg-[var(--tk-accent)] px-2.5 py-1 text-xs font-semibold text-[var(--tk-accent-text-on)] transition-colors hover:bg-[var(--tk-accent-hover)] disabled:opacity-50"
                      >
                        Save note
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--tk-text-dim)]">
                    Highlight a range of lines in the editor, then use the
                    “+ Note” button to save a note referencing that range.
                  </p>
                )}

                {notes.length === 0 ? (
                  <p className="text-xs text-[var(--tk-text-faint)]">No notes yet.</p>
                ) : (
                  notes.map((note) => (
                    <div
                      key={note.id}
                      className="rounded-lg border border-[var(--tk-border)] bg-[var(--tk-bg-elevated)] p-3 transition-colors hover:border-[var(--tk-accent)]"
                    >
                      <button
                        type="button"
                        onClick={() => openNote(note)}
                        className="flex w-full items-center justify-between text-left"
                      >
                        <span className="tk-mono text-[11px] font-semibold text-[var(--tk-accent)]">
                          {note.filePath.split("/").pop()} · L{note.startLine}
                          {note.endLine !== note.startLine ? `-${note.endLine}` : ""}
                        </span>
                        <Trash2
                          className="h-3.5 w-3.5 shrink-0 text-[var(--tk-text-dim)] transition-colors hover:text-[var(--tk-danger)]"
                          onClick={(event) => {
                            event.stopPropagation();
                            deleteNote(note.id);
                          }}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => openNote(note)}
                        className="mt-1 block w-full text-left text-xs text-[var(--tk-text-muted)] whitespace-pre-wrap"
                      >
                        {note.text}
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </aside>
        ) : null}
      </main>

      {/* Submit overlay */}
      {status === "ending" || status === "ended" ? (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-[420px] max-w-[90vw] rounded-xl border border-[var(--tk-border)] bg-[var(--tk-bg-elevated)] p-8 text-center">
            {status === "ending" ? (
              <>
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-[var(--tk-accent)]" />
                <h2 className="mt-4 text-lg font-bold text-[var(--tk-text)]">
                  Submitting your interview…
                </h2>
                <p className="mt-2 text-sm text-[var(--tk-text-dim)]">
                  Uploading the recording and starting analysis. Please keep this
                  tab open.
                </p>
              </>
            ) : (
              <>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--tk-accent)]/15 text-[var(--tk-accent)]">
                  ✓
                </div>
                <h2 className="mt-4 text-lg font-bold text-[var(--tk-text)]">
                  Interview submitted
                </h2>
                <p className="mt-2 text-sm text-[var(--tk-text-dim)]">
                  Your session is being processed. The recruiter will see your
                  results on their dashboard.
                </p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="mt-6 rounded-md bg-[var(--tk-accent)] px-4 py-2 text-sm font-semibold text-[var(--tk-accent-text-on)] transition-colors hover:bg-[var(--tk-accent-hover)]"
                >
                  Return to lobby
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
