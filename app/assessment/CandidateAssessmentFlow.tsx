"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Camera, Check, Mic, MonitorUp, ShieldCheck } from "lucide-react";
import {
  joinAssessment,
  type CandidateAssessmentSession,
  type CandidateEntryState,
} from "@/app/assessment/actions";
import { InterviewWorkspace } from "@/app/assessment/InterviewWorkspace";

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
  initialAccessCode,
  state,
  formAction,
  pending,
}: {
  formAction: (payload: FormData) => void;
  initialAccessCode: string;
  pending: boolean;
  state: CandidateEntryState;
}) {
  const hasInitialAccessCode = initialAccessCode.length > 0;

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
              defaultValue={initialAccessCode}
              name="accessCode"
              placeholder="ABC123"
              required
              autoFocus={!hasInitialAccessCode}
            />
            <FieldError message={state.fieldErrors?.accessCode} />
          </label>

          <label className="grid gap-1.5 text-sm font-medium text-[#202322]">
            Full name
            <input
              autoFocus={hasInitialAccessCode}
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

function AssessmentStep({ session }: { session: CandidateAssessmentSession }) {
  return <InterviewWorkspace session={session} />;
}

export function CandidateAssessmentFlow({
  initialAccessCode = "",
}: {
  initialAccessCode?: string;
}) {
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
    <EntryStep
      formAction={formAction}
      initialAccessCode={initialAccessCode}
      pending={pending}
      state={entryState}
    />
  );
}
