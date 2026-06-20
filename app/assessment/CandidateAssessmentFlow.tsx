"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Camera,
  Check,
  ChevronDown,
  Clock,
  Code2,
  Folder,
  LogOut,
  Mic,
  MonitorUp,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  joinAssessment,
  type CandidateAssessmentSession,
  type CandidateEntryState,
} from "@/app/assessment/actions";
import type { CodebaseFile } from "@/app/dashboard/data";

type LobbyStep = "entry" | "checks" | "expect" | "assessment";
type CheckStatus = "idle" | "checking" | "ready" | "blocked";

const initialCandidateEntryState: CandidateEntryState = {
  status: "idle",
};

const technologyLabels: Record<string, string> = {
  python: "Python",
  react_javascript: "React",
};

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <p className="mt-2 text-xs leading-5 text-red-700" role="alert">
      {message}
    </p>
  );
}

function StatusPill({
  label,
  status,
}: {
  label: string;
  status: CheckStatus;
}) {
  const ready = status === "ready";
  const blocked = status === "blocked";

  return (
    <p
      className={cx(
        "inline-flex items-center gap-2 text-xs font-semibold",
        ready && "text-[#314200]",
        blocked && "text-red-700",
        status === "idle" && "text-[#62675e]",
        status === "checking" && "text-[#4f554d]",
      )}
    >
      <span
        className={cx(
          "grid h-5 w-5 place-items-center rounded-full",
          ready && "bg-primary text-[#111510]",
          blocked && "bg-red-100 text-red-700",
          status === "idle" && "bg-[#efeeeb] text-[#62675e]",
          status === "checking" && "bg-[#fbfaf7] text-[#62675e]",
        )}
      >
        {ready ? <Check size={13} /> : null}
      </span>
      {label}
    </p>
  );
}

function EntryStep({
  state,
  formAction,
  pending,
}: {
  formAction: (payload: FormData) => void;
  pending: boolean;
  state: CandidateEntryState;
}) {
  return (
    <section className="grid min-h-screen bg-white px-4 py-8 sm:px-8 lg:grid-cols-[1fr_420px] lg:gap-8 lg:px-12">
      <div className="flex max-w-[720px] flex-col justify-center">
        <h1 className="text-[46px] font-black leading-none text-[#202322] sm:text-[58px]">
          Chayote
        </h1>
        <p className="mt-5 max-w-[620px] text-lg leading-8 text-[#3f443b]">
          Enter your assessment code and full name to prepare your environment
          before starting the technical evaluation.
        </p>
      </div>

      <form
        action={formAction}
        className="mt-8 self-center border border-[#f0eeea] bg-white p-5 shadow-[0_1px_8px_rgba(30,30,26,0.03)] lg:mt-0"
      >
        <h2 className="text-2xl font-bold text-[#202322]">Access test</h2>
        <p className="mt-2 text-sm leading-6 text-[#62675e]">
          Use the code shared by your recruiter.
        </p>

        {state.message ? (
          <p
            className="mt-4 rounded-[6px] border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
            role="status"
          >
            {state.message}
          </p>
        ) : null}

        <div className="mt-5 grid gap-4">
          <label className="grid gap-1.5 text-sm font-medium text-[#202322]">
            Assessment code
            <input
              className="h-11 rounded-[3px] border border-[#dedbd5] bg-white px-3 font-mono text-[15px] uppercase tracking-[0.12em] outline-none focus:border-[#202322] focus:ring-2 focus:ring-[#d7ff5a]"
              name="accessCode"
              placeholder="ABC123"
              required
            />
            <FieldError message={state.fieldErrors?.accessCode} />
          </label>

          <label className="grid gap-1.5 text-sm font-medium text-[#202322]">
            Full name
            <input
              className="h-11 rounded-[3px] border border-[#dedbd5] bg-white px-3 text-[14px] outline-none focus:border-[#202322] focus:ring-2 focus:ring-[#d7ff5a]"
              name="fullName"
              placeholder="Avery Johnson"
              required
            />
            <FieldError message={state.fieldErrors?.fullName} />
          </label>

          <button
            className="mt-1 inline-flex h-11 items-center justify-center rounded-[3px] bg-primary px-4 text-sm font-bold text-[#111510] transition duration-150 hover:bg-[#d7ff5a] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={pending}
            type="submit"
          >
            {pending ? "Opening" : "Continue"}
          </button>
        </div>
      </form>
    </section>
  );
}

function EquipmentStep({
  onContinue,
  session,
}: {
  onContinue: () => void;
  session: CandidateAssessmentSession;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [audioStatus, setAudioStatus] = useState<CheckStatus>("idle");
  const [cameraStatus, setCameraStatus] = useState<CheckStatus>("idle");
  const [audioLevel, setAudioLevel] = useState(0);

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        window.cancelAnimationFrame(animationRef.current);
      }

      audioStreamRef.current?.getTracks().forEach((track) => track.stop());
      videoStreamRef.current?.getTracks().forEach((track) => track.stop());
      void audioContextRef.current?.close();
    };
  }, []);

  async function runChecks() {
    setAudioStatus("checking");
    setCameraStatus("checking");

    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      audioStreamRef.current = audioStream;
      setAudioStatus("ready");

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 128;
      audioContext.createMediaStreamSource(audioStream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        analyser.getByteFrequencyData(data);
        const average =
          data.reduce((sum, value) => sum + value, 0) / Math.max(data.length, 1);
        setAudioLevel(Math.min(1, average / 80));
        animationRef.current = window.requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch {
      setAudioStatus("blocked");
    }

    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });
      videoStreamRef.current = videoStream;

      if (videoRef.current) {
        videoRef.current.srcObject = videoStream;
      }

      setCameraStatus("ready");
    } catch {
      setCameraStatus("blocked");
    }
  }

  const checksReady = audioStatus === "ready" && cameraStatus === "ready";

  return (
    <section className="min-h-screen bg-white px-4 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-[1120px]">
        <p className="mb-4 flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.18em] text-[#4f554d]">
          <span className="h-2 w-2 rounded-full bg-primary" />
          Equipment check
        </p>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-[42px] font-black leading-tight text-[#202322]">
              Prepare your setup
            </h1>
            <p className="mt-3 max-w-[680px] text-base leading-7 text-[#3f443b]">
              {session.candidateName}, we need your microphone and camera
              ready before the interview begins.
            </p>
          </div>
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[3px] border border-[#d8d5cf] px-4 text-sm font-semibold text-[#202322] transition duration-150 hover:border-[#c7c2ba] hover:bg-[#fbfaf7] lg:w-fit"
            onClick={runChecks}
            type="button"
          >
            <ShieldCheck size={16} />
            Run checks
          </button>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <article className="border border-[#f0eeea] bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-[#202322]">Audio Check</h2>
                <p className="mt-3 text-sm leading-6 text-[#4f554d]">
                  Speak normally and watch for microphone activity.
                </p>
              </div>
              <Mic className="text-[#4f554d]" size={22} />
            </div>

            <div className="mt-5 flex h-[112px] items-end justify-center gap-2 bg-[#f4f3f1] px-6 py-5">
              {Array.from({ length: 12 }).map((_, index) => {
                const level = audioStatus === "ready" ? audioLevel : 0.18;
                const height = 18 + Math.round(((index % 5) + 1) * 8 * level);

                return (
                  <span
                    className="w-2 rounded-t-[2px] bg-[#202322]"
                    key={index}
                    style={{ height }}
                  />
                );
              })}
            </div>

            <div className="mt-5">
              <StatusPill
                label={
                  audioStatus === "blocked"
                    ? "Microphone unavailable"
                    : audioStatus === "ready"
                      ? "Microphone detected"
                      : "Microphone not checked"
                }
                status={audioStatus}
              />
            </div>
          </article>

          <article className="border border-[#f0eeea] bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-[#202322]">Camera Check</h2>
                <p className="mt-3 text-sm leading-6 text-[#4f554d]">
                  Keep your face visible in a quiet, well-lit space.
                </p>
              </div>
              <Camera className="text-[#4f554d]" size={22} />
            </div>

            <div className="mt-5 grid h-[220px] place-items-center overflow-hidden bg-[#f4f3f1]">
              <video
                autoPlay
                className={cx(
                  "h-full w-full object-cover",
                  cameraStatus !== "ready" && "hidden",
                )}
                muted
                playsInline
                ref={videoRef}
              />
              {cameraStatus !== "ready" ? (
                <Camera className="text-[#888b82]" size={42} />
              ) : null}
            </div>

            <div className="mt-5">
              <StatusPill
                label={
                  cameraStatus === "blocked"
                    ? "Camera unavailable"
                    : cameraStatus === "ready"
                      ? "Camera detected"
                      : "Camera not checked"
                }
                status={cameraStatus}
              />
            </div>
          </article>
        </div>

        <button
          className="mt-6 inline-flex h-11 items-center justify-center rounded-[3px] bg-primary px-5 text-sm font-bold text-[#111510] transition duration-150 hover:bg-[#d7ff5a] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!checksReady}
          onClick={onContinue}
          type="button"
        >
          Continue
        </button>
      </div>
    </section>
  );
}

function ExpectStep({
  onStart,
  session,
}: {
  onStart: () => void;
  session: CandidateAssessmentSession;
}) {
  const technologies = session.technologies
    .map((technology) => technologyLabels[technology] ?? technology)
    .join(" + ");

  return (
    <section className="min-h-screen bg-white px-4 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto grid max-w-[1120px] gap-8 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col justify-center">
          <h1 className="text-[46px] font-black leading-none text-[#202322] sm:text-[58px]">
            What to Expect
          </h1>
          <p className="mt-5 max-w-[680px] text-lg leading-8 text-[#3f443b]">
            You are about to start {session.title}. The assessment is designed
            to feel like a focused technical conversation.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="border border-[#f0eeea] p-4">
              <p className="text-xs font-semibold text-[#62675e]">Candidate</p>
              <p className="mt-2 font-bold text-[#202322]">
                {session.candidateName}
              </p>
            </div>
            <div className="border border-[#f0eeea] p-4">
              <p className="text-xs font-semibold text-[#62675e]">Time</p>
              <p className="mt-2 font-bold text-[#202322]">
                {session.timeLimitMinutes} minutes
              </p>
            </div>
            <div className="border border-[#f0eeea] p-4">
              <p className="text-xs font-semibold text-[#62675e]">Stack</p>
              <p className="mt-2 font-bold text-[#202322]">{technologies}</p>
            </div>
          </div>
        </div>

        <aside className="border border-[#f0eeea] bg-white p-6">
          <h2 className="text-2xl font-bold text-[#202322]">What to Expect</h2>
          <div className="mt-6 grid gap-5">
            {[
              [
                "Conversational AI",
                "The AI will ask technical questions and follow up based on your verbal responses.",
              ],
              [
                "Think Out Loud",
                "Verbalize your thought process. The AI evaluates approach as much as final answers.",
              ],
              [
                "Code Review",
                "You will inspect a small realistic codebase and explain what you find.",
              ],
              [
                "Time Constraints",
                `You will have ${session.timeLimitMinutes} minutes to complete the assessment.`,
              ],
            ].map(([title, description], index) => (
              <div className="grid grid-cols-[32px_1fr] gap-3" key={title}>
                <span className="grid h-7 w-7 place-items-center rounded-full bg-[#f4f3f1] text-xs font-bold text-[#4f554d]">
                  {index + 1}
                </span>
                <div>
                  <p className="font-bold text-[#202322]">{title}</p>
                  <p className="mt-1 text-sm leading-6 text-[#4f554d]">
                    {description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <button
            className="mt-7 inline-flex h-14 w-full items-center justify-center gap-3 rounded-[3px] bg-primary px-5 text-lg font-black text-[#111510] transition duration-150 hover:bg-[#d7ff5a]"
            onClick={onStart}
            type="button"
          >
            Take assessment
            <MonitorUp size={20} />
          </button>
          <p className="mt-3 text-center font-mono text-xs font-bold tracking-[0.15em] text-[#4f554d]">
            Full screen will begin.
          </p>
        </aside>
      </div>
    </section>
  );
}

const TK_MONO =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

const workspaceCss = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
@keyframes tk-pulse-height { 0%, 100% { height: 4px; } 50% { height: 16px; } }
.tk-wf { animation: tk-pulse-height 1s ease-in-out infinite; }
.tk-wf:nth-child(2) { animation-delay: 0.2s; }
.tk-wf:nth-child(3) { animation-delay: 0.4s; }
.tk-wf:nth-child(4) { animation-delay: 0.6s; }
.tk-wf:nth-child(5) { animation-delay: 0.8s; }
.tk-scope { font-family: 'Inter', sans-serif; }
.tk-mono { font-family: ${TK_MONO}; }
.tk-scope ::-webkit-scrollbar { width: 8px; height: 8px; }
.tk-scope ::-webkit-scrollbar-track { background: transparent; }
.tk-scope ::-webkit-scrollbar-thumb { background: #444746; border-radius: 4px; }
.tk-scope ::-webkit-scrollbar-thumb:hover { background: #8e918f; }
`;

type TreeNode = {
  name: string;
  path: string;
  isDir: boolean;
  children: TreeNode[];
};

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
      if (a.isDir !== b.isDir) {
        return a.isDir ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    node.children.forEach(sortNodes);
  };

  sortNodes(root);
  return root.children;
}

function fileGlyph(name: string) {
  if (name.endsWith(".json")) return "{}";
  if (name.endsWith(".py")) return "py";
  if (name.endsWith(".md")) return "md";
  if (name.endsWith(".txt")) return "··";
  return "<>";
}

function initialSeconds(session: CandidateAssessmentSession) {
  if (session.expiresAt) {
    const ms = new Date(session.expiresAt).getTime() - Date.now();
    if (!Number.isNaN(ms)) {
      return Math.max(0, Math.floor(ms / 1000));
    }
  }

  return Math.max(0, session.timeLimitMinutes * 60);
}

function formatClock(total: number) {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function AssessmentStep({ session }: { session: CandidateAssessmentSession }) {
  const files = session.codeFiles;
  const tree = buildFileTree(files);

  const [activePath, setActivePath] = useState(files[0]?.path ?? "");
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
  const [scratchOpen, setScratchOpen] = useState(false);
  const [scratch, setScratch] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(() => initialSeconds(session));

  useEffect(() => {
    const id = setInterval(() => {
      setSecondsLeft((value) => (value <= 0 ? 0 : value - 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const activeFile =
    files.find((file) => file.path === activePath) ?? files[0] ?? null;
  const activeName = activeFile ? activeFile.path.split("/").pop() : "";

  function toggleDir(path: string) {
    setOpenDirs((previous) => {
      const next = new Set(previous);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }

  function endSession() {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm("End the assessment session?");
      if (!confirmed) {
        return;
      }
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      window.location.reload();
    }
  }

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
              className="group flex w-full items-center space-x-2 rounded px-2 py-1.5 text-left text-[#c4c7c5] transition-colors hover:bg-[#292a2a]"
            >
              <ChevronDown
                className={cx(
                  "h-4 w-4 shrink-0 text-[#8e918f] transition-transform group-hover:text-[#c4c7c5]",
                  !open && "-rotate-90",
                )}
              />
              <Folder className="h-4 w-4 shrink-0 text-[#8e918f]" />
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
            "relative flex w-full items-center space-x-2 rounded px-2 py-1.5 text-left transition-colors",
            active
              ? "bg-[#4ade80]/10 text-[#4ade80] before:absolute before:left-0 before:top-0 before:h-full before:w-[2px] before:bg-[#4ade80] before:content-['']"
              : "text-[#c4c7c5] hover:bg-[#292a2a] hover:text-[#e2e2e2]",
          )}
        >
          <span className="tk-mono w-4 shrink-0 text-center text-xs font-bold">
            {fileGlyph(node.name)}
          </span>
          <span className="truncate">{node.name}</span>
        </button>
      );
    });

  return (
    <div className="tk-scope fixed inset-0 flex flex-col overflow-hidden bg-[#0d0e0f] text-[#e2e2e2] selection:bg-[#005321] selection:text-[#6efb9b]">
      <style>{workspaceCss}</style>

      {/* Floating Recruiter Bar */}
      <div className="absolute top-4 left-1/2 z-50 flex -translate-x-1/2 items-center space-x-3 rounded-full border border-[#444746] bg-[#343535] px-4 py-2 shadow-lg">
        <div className="flex items-center space-x-2">
          <div className="h-2 w-2 animate-pulse rounded-full bg-[#4ade80]" />
          <span className="text-xs font-medium uppercase tracking-wide text-[#e2e2e2]">
            Recruiter
          </span>
        </div>
        <div className="flex h-4 items-center space-x-1">
          <div className="tk-wf w-1 rounded-full bg-[#4ade80]" style={{ height: "8px" }} />
          <div className="tk-wf w-1 rounded-full bg-[#4ade80]" style={{ height: "12px" }} />
          <div className="tk-wf w-1 rounded-full bg-[#4ade80]" style={{ height: "16px" }} />
          <div className="tk-wf w-1 rounded-full bg-[#4ade80]" style={{ height: "10px" }} />
          <div className="tk-wf w-1 rounded-full bg-[#4ade80]" style={{ height: "6px" }} />
        </div>
      </div>

      {/* Main Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-[#444746] bg-[#121414] px-6 py-3">
        <div className="flex min-w-0 items-center space-x-4">
          <div className="text-xl font-bold tracking-tight text-[#e2e2e2]">TALKODE</div>
          <div className="h-4 w-px bg-[#444746]" />
          <div className="truncate text-xs font-medium uppercase tracking-widest text-[#c4c7c5]">
            {session.title}
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 rounded-md border border-[#444746] bg-[#1b1c1c] px-3 py-1.5">
            <Clock className="h-4 w-4 text-[#c4c7c5]" />
            <span className="tk-mono text-sm font-semibold text-[#e2e2e2]">
              {formatClock(secondsLeft)}
            </span>
          </div>
          <button
            type="button"
            onClick={endSession}
            className="flex items-center space-x-2 rounded-md px-3 py-1.5 text-sm font-semibold text-[#ffb4ab] transition-colors hover:bg-[#93000a]/10 hover:text-[#ffdad6]"
          >
            <LogOut className="h-4 w-4" />
            <span>END SESSION</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex flex-1 overflow-hidden">
        {/* File Explorer Sidebar */}
        <aside className="flex w-64 shrink-0 flex-col border-r border-[#444746] bg-[#1f2020]">
          <div className="flex items-center justify-between border-b border-[#444746] p-4 text-xs font-semibold uppercase tracking-wider text-[#c4c7c5]">
            <span>Codebase</span>
            <Folder className="h-4 w-4" />
          </div>
          <div className="tk-mono flex-1 overflow-y-auto p-2 text-sm">
            {files.length > 0 ? (
              renderNodes(tree, 0)
            ) : (
              <p className="px-2 py-2 text-[#8e918f]">No files loaded.</p>
            )}
          </div>
        </aside>

        {/* Code Editor */}
        <section className="flex min-w-0 flex-1 flex-col bg-[#0d0e0f]">
          {/* Editor Header */}
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-[#444746] bg-[#1b1c1c] px-4">
            <div className="flex h-full items-center">
              <div className="tk-mono flex h-full items-center border-b-2 border-[#4ade80] bg-[#0d0e0f] px-4 text-sm text-[#4ade80]">
                {activeName || "No file"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setScratchOpen((value) => !value)}
              className={cx(
                "flex items-center space-x-2 rounded border px-3 py-1.5 text-xs font-semibold transition-colors",
                scratchOpen
                  ? "border-[#4ade80] bg-[#4ade80]/10 text-[#4ade80]"
                  : "border-[#4ade80]/30 text-[#4ade80] hover:bg-[#4ade80]/10",
              )}
            >
              <Code2 className="h-3 w-3" />
              <span>TOGGLE SCRATCHPAD</span>
            </button>
          </div>
          {/* Editor Content */}
          <div className="tk-mono flex-1 overflow-auto bg-[#0d0e0f] text-sm leading-relaxed">
            {activeFile ? (
              <div className="flex min-h-full min-w-full w-max">
                <div className="select-none border-r border-[#1f2020] px-3 py-4 text-right text-[#4a4f48]">
                  {activeFile.content.split("\n").map((_, index) => (
                    <div key={index}>{index + 1}</div>
                  ))}
                </div>
                <pre className="m-0 flex-1 py-4 pl-4 pr-6 text-[#c4c7c5]">
                  {activeFile.content}
                </pre>
              </div>
            ) : (
              <div className="p-6 text-[#8e918f]">No file selected.</div>
            )}
          </div>
        </section>

        {/* Scratchpad */}
        {scratchOpen ? (
          <aside className="flex w-80 shrink-0 flex-col border-l border-[#444746] bg-[#121414]">
            <div className="flex items-center justify-between border-b border-[#444746] px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#c4c7c5]">
              <span>Scratchpad</span>
              <button
                type="button"
                onClick={() => setScratchOpen(false)}
                className="text-[#8e918f] transition-colors hover:text-[#e2e2e2]"
                aria-label="Close scratchpad"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <textarea
              value={scratch}
              onChange={(event) => setScratch(event.target.value)}
              placeholder="Jot down notes, plan your approach, sketch pseudocode…"
              className="tk-mono flex-1 resize-none bg-transparent p-4 text-sm leading-relaxed text-[#e2e2e2] outline-none placeholder:text-[#5a5f57]"
            />
          </aside>
        ) : null}
      </main>
    </div>
  );
}

export function CandidateAssessmentFlow() {
  const [entryState, formAction, pending] = useActionState(
    joinAssessment,
    initialCandidateEntryState,
  );
  const [step, setStep] = useState<LobbyStep>("entry");
  const session = entryState.session;
  const activeStep = step === "entry" && session ? "checks" : step;

  async function startAssessment() {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // Some browsers deny fullscreen. The assessment should still proceed.
    }

    setStep("assessment");
  }

  if (activeStep === "assessment" && session) {
    return <AssessmentStep session={session} />;
  }

  if (activeStep === "expect" && session) {
    return <ExpectStep onStart={startAssessment} session={session} />;
  }

  if (activeStep === "checks" && session) {
    return (
      <EquipmentStep onContinue={() => setStep("expect")} session={session} />
    );
  }

  return (
    <EntryStep formAction={formAction} pending={pending} state={entryState} />
  );
}
