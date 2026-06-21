"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createSession,
  endSession,
  postSnapshot,
  voiceWsBase,
  type CreateSessionBody,
  type InterviewServerMessage,
} from "@/lib/voiceAgent";

export type InterviewStatus =
  | "idle"
  | "connecting"
  | "live"
  | "ending"
  | "ended"
  | "error";

export type FeedMessage = {
  id: string;
  role: "agent" | "you" | "system";
  text: string;
};

type StartArgs = CreateSessionBody & {
  // Called every few seconds to capture the candidate's current code.
  getCode: () => string;
};

const SNAPSHOT_INTERVAL_MS = 4000;
const TARGET_SAMPLE_RATE = 16000;

function randomId() {
  return Math.random().toString(36).slice(2);
}

// Float32 mic samples -> 16kHz little-endian linear16 PCM (what Deepgram expects).
function encodePcm16(input: Float32Array, inputRate: number): ArrayBuffer {
  let samples = input;
  if (inputRate !== TARGET_SAMPLE_RATE) {
    const ratio = inputRate / TARGET_SAMPLE_RATE;
    const length = Math.round(input.length / ratio);
    samples = new Float32Array(length);
    for (let i = 0; i < length; i += 1) {
      const position = i * ratio;
      const low = Math.floor(position);
      const high = Math.min(low + 1, input.length - 1);
      const frac = position - low;
      samples[i] = input[low] * (1 - frac) + input[high] * frac;
    }
  }

  const buffer = new ArrayBuffer(samples.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }
  return buffer;
}

function pickRecorderMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const type of ["audio/webm;codecs=opus", "audio/webm", "audio/ogg"]) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return undefined;
}

export function useInterviewSession() {
  const [status, setStatus] = useState<InterviewStatus>("idle");
  const [messages, setMessages] = useState<FeedMessage[]>([]);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [interviewComplete, setInterviewComplete] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const snapshotTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const getCodeRef = useRef<() => string>(() => "");
  const startedRef = useRef(false);

  const pushMessage = useCallback((role: FeedMessage["role"], text: string) => {
    setMessages((prev) => [...prev, { id: randomId(), role, text }]);
  }, []);

  const teardownAudio = useCallback(() => {
    if (snapshotTimerRef.current) {
      clearInterval(snapshotTimerRef.current);
      snapshotTimerRef.current = null;
    }
    try {
      processorRef.current?.disconnect();
    } catch {}
    processorRef.current = null;
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close().catch(() => {});
    }
    audioCtxRef.current = null;
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) {
      try {
        wsRef.current.close();
      } catch {}
    }
    wsRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(
    async (args: StartArgs) => {
      if (startedRef.current) return;
      startedRef.current = true;
      getCodeRef.current = args.getCode;
      setStatus("connecting");
      setError(null);

      try {
        const { session_id } = await createSession({
          candidate_name: args.candidate_name,
          problem_id: args.problem_id,
          problem_title: args.problem_title,
          problem_statement: args.problem_statement,
          question_guidelines: args.question_guidelines,
        });
        setSessionId(session_id);

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
        streamRef.current = stream;

        // Live audio path: mic -> ScriptProcessor -> 16k PCM -> WebSocket.
        const AudioCtor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        const audioCtx = new AudioCtor({ sampleRate: TARGET_SAMPLE_RATE });
        audioCtxRef.current = audioCtx;
        if (audioCtx.state === "suspended") {
          await audioCtx.resume().catch(() => {});
        }
        const source = audioCtx.createMediaStreamSource(stream);
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (event) => {
          const ws = wsRef.current;
          if (!ws || ws.readyState !== WebSocket.OPEN) return;
          const channel = event.inputBuffer.getChannelData(0);
          ws.send(encodePcm16(channel, audioCtx.sampleRate));
        };

        // Mute the processor output so the candidate doesn't hear themselves.
        const silentGain = audioCtx.createGain();
        silentGain.gain.value = 0;
        source.connect(processor);
        processor.connect(silentGain);
        silentGain.connect(audioCtx.destination);

        // Recording path for the batch pipeline (full-session upload on end).
        const mimeType = pickRecorderMime();
        const recorder = new MediaRecorder(
          stream,
          mimeType ? { mimeType } : undefined,
        );
        recorderRef.current = recorder;
        chunksRef.current = [];
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunksRef.current.push(event.data);
        };
        recorder.start(1000);

        // WebSocket for transcript + agent responses.
        const ws = new WebSocket(`${voiceWsBase()}/interview/${session_id}`);
        ws.binaryType = "arraybuffer";
        wsRef.current = ws;

        ws.onopen = () => setStatus("live");
        ws.onerror = () => {
          setError("Interview connection error.");
          setStatus("error");
        };
        ws.onclose = () => {
          setStatus((prev) => (prev === "live" ? "ended" : prev));
        };
        ws.onmessage = (event) => {
          let payload: InterviewServerMessage;
          try {
            payload = JSON.parse(event.data as string);
          } catch {
            return;
          }
          if (payload.type === "transcript_chunk") {
            if (payload.is_final) {
              setInterim("");
              pushMessage("you", payload.text);
            } else {
              setInterim(payload.text);
            }
          } else if (payload.type === "agent_audio") {
            const binary = atob(payload.audio_b64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            const blob = new Blob([bytes], { type: "audio/mpeg" });
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            setSpeaking(true);
            audio.onended = () => {
              setSpeaking(false);
              URL.revokeObjectURL(url);
            };
            audio.onerror = () => {
              setSpeaking(false);
              URL.revokeObjectURL(url);
            };
            audio.play().catch(() => setSpeaking(false));
          } else if (
            payload.type === "agent_intro" ||
            payload.type === "agent_response"
          ) {
            // fallback if TTS failed
            pushMessage("agent", payload.text);
          } else if (payload.type === "interview_complete") {
            setInterviewComplete(true);
          } else if (payload.type === "error") {
            setError(payload.text);
          }
        };

        // Periodic code snapshots.
        snapshotTimerRef.current = setInterval(() => {
          const code = getCodeRef.current();
          if (!code) return;
          postSnapshot(session_id, code).catch(() => {});
        }, SNAPSHOT_INTERVAL_MS);
      } catch (caught) {
        startedRef.current = false;
        const message =
          caught instanceof Error ? caught.message : "Could not start interview.";
        setError(message);
        setStatus("error");
        teardownAudio();
      }
    },
    [pushMessage, teardownAudio],
  );

  // Stops capture, uploads the recording, and triggers the batch pipeline.
  const end = useCallback(async (): Promise<boolean> => {
    const id = sessionId;
    setStatus("ending");

    const recorder = recorderRef.current;
    const finalBlob = await new Promise<Blob | null>((resolve) => {
      if (!recorder || recorder.state === "inactive") {
        resolve(
          chunksRef.current.length
            ? new Blob(chunksRef.current, {
                type: chunksRef.current[0]?.type || "audio/webm",
              })
            : null,
        );
        return;
      }
      recorder.onstop = () => {
        resolve(
          new Blob(chunksRef.current, {
            type: recorder.mimeType || "audio/webm",
          }),
        );
      };
      recorder.stop();
    });

    teardownAudio();

    if (id && finalBlob && finalBlob.size > 0) {
      try {
        await endSession(id, finalBlob);
      } catch (caught) {
        const message =
          caught instanceof Error ? caught.message : "Upload failed.";
        setError(message);
        setStatus("ended");
        return false;
      }
    }

    setStatus("ended");
    return true;
  }, [sessionId, teardownAudio]);

  useEffect(() => {
    return () => {
      teardownAudio();
    };
  }, [teardownAudio]);

  return { status, messages, interim, error, sessionId, speaking, interviewComplete, start, end };
}
