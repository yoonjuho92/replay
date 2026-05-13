"use client";

import { useEffect, useRef, useState } from "react";
import { transcribeAudio } from "../_actions/transcribe";

const SILENCE_RMS_THRESHOLD = 0.012;
const SILENCE_HANG_MS = 1500;
const SPEECH_START_RMS = 0.02;
const MAX_RECORD_MS = 60_000;
const ANALYSER_TICK_MS = 100;

type State = "idle" | "recording" | "transcribing";

type Props = {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  className?: string;
};

export function MicButton({ onTranscript, disabled, className }: Props) {
  const [state, setState] = useState<State>("idle");
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const tickIntervalRef = useRef<number | null>(null);
  const maxTimeoutRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const sawSpeechRef = useRef(false);
  const silenceSinceRef = useRef<number | null>(null);
  const stoppedRef = useRef(false);

  function cleanupRecording() {
    if (tickIntervalRef.current != null) {
      window.clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }
    if (maxTimeoutRef.current != null) {
      window.clearTimeout(maxTimeoutRef.current);
      maxTimeoutRef.current = null;
    }
    try {
      analyserRef.current?.disconnect();
    } catch {
      // ignore
    }
    analyserRef.current = null;
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close().catch(() => {});
    }
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }

  function stopRecording() {
    if (stoppedRef.current) return;
    stoppedRef.current = true;
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop();
      } catch {
        // ignore
      }
    }
  }

  function pickMimeType(): string {
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4",
    ];
    for (const c of candidates) {
      if (
        typeof MediaRecorder !== "undefined" &&
        MediaRecorder.isTypeSupported?.(c)
      ) {
        return c;
      }
    }
    return "";
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(
      typeof window !== "undefined" &&
        typeof window.MediaRecorder !== "undefined" &&
        typeof navigator !== "undefined" &&
        typeof navigator.mediaDevices?.getUserMedia === "function",
    );
    return () => {
      cleanupRecording();
    };
  }, []);

  async function start() {
    if (disabled || state !== "idle") return;
    setError(null);
    sawSpeechRef.current = false;
    silenceSinceRef.current = null;
    stoppedRef.current = false;
    chunksRef.current = [];

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setError(
        err instanceof Error && err.name === "NotAllowedError"
          ? "마이크 권한이 필요해요."
          : "마이크를 사용할 수 없어요.",
      );
      return;
    }
    streamRef.current = stream;

    const mimeType = pickMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch (err) {
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setError(
        err instanceof Error
          ? `녹음을 시작하지 못했어요: ${err.message}`
          : "녹음을 시작하지 못했어요.",
      );
      return;
    }
    recorderRef.current = recorder;

    recorder.addEventListener("dataavailable", (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    });
    recorder.addEventListener("stop", async () => {
      cleanupRecording();
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || "audio/webm",
      });
      chunksRef.current = [];

      if (blob.size === 0 || !sawSpeechRef.current) {
        setState("idle");
        if (!sawSpeechRef.current) {
          setError("말소리가 감지되지 않았어요.");
        }
        return;
      }

      setState("transcribing");
      try {
        const ext = (recorder.mimeType || "audio/webm").includes("ogg")
          ? "ogg"
          : (recorder.mimeType || "").includes("mp4")
            ? "mp4"
            : "webm";
        const fd = new FormData();
        fd.append("audio", blob, `audio.${ext}`);
        const res = await transcribeAudio(fd);
        if (res.error) {
          setError(res.error);
        } else if (res.text) {
          onTranscript(res.text);
        } else {
          setError("받아쓴 내용이 비어 있어요.");
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "음성 인식에 실패했어요.",
        );
      } finally {
        setState("idle");
      }
    });

    // Voice activity detection
    const AC: typeof AudioContext =
      window.AudioContext ??
      (
        window as unknown as { webkitAudioContext: typeof AudioContext }
      ).webkitAudioContext;
    const audioCtx = new AC();
    audioCtxRef.current = audioCtx;
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.8;
    source.connect(analyser);
    analyserRef.current = analyser;

    const buf = new Float32Array(analyser.fftSize);
    tickIntervalRef.current = window.setInterval(() => {
      const a = analyserRef.current;
      if (!a) return;
      a.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);

      if (!sawSpeechRef.current) {
        if (rms > SPEECH_START_RMS) {
          sawSpeechRef.current = true;
          silenceSinceRef.current = null;
        }
        return;
      }

      if (rms < SILENCE_RMS_THRESHOLD) {
        if (silenceSinceRef.current == null) {
          silenceSinceRef.current = Date.now();
        } else if (Date.now() - silenceSinceRef.current >= SILENCE_HANG_MS) {
          stopRecording();
        }
      } else {
        silenceSinceRef.current = null;
      }
    }, ANALYSER_TICK_MS);

    maxTimeoutRef.current = window.setTimeout(() => {
      stopRecording();
    }, MAX_RECORD_MS);

    try {
      recorder.start(250);
      setState("recording");
    } catch (err) {
      cleanupRecording();
      setError(
        err instanceof Error ? err.message : "녹음을 시작하지 못했어요.",
      );
    }
  }

  if (!supported) {
    return null;
  }

  const listening = state === "recording";
  const busy = state === "transcribing";

  return (
    <div className={`flex flex-col items-stretch gap-1 ${className ?? ""}`}>
      <button
        type="button"
        onClick={listening ? stopRecording : start}
        disabled={disabled || busy}
        aria-pressed={listening}
        aria-label={
          busy
            ? "음성 인식 중"
            : listening
              ? "음성 인식 중지"
              : "음성 인식 시작"
        }
        className={`flex h-full items-center justify-center rounded-md border-2 border-[#503836] px-3 py-2 text-base font-bold transition-colors disabled:opacity-60 ${
          listening
            ? "animate-pulse bg-[#B0413E] text-white"
            : busy
              ? "bg-[#F3F7FA] text-[#503836]"
              : "bg-white text-[#503836] hover:bg-[#F3F7FA]"
        }`}
      >
        {busy ? <Spinner className="h-5 w-5" /> : <MicIcon className="h-5 w-5" />}
      </button>
      {error && (
        <span className="text-[0.7rem] text-[#B0413E]" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="12" y1="18" x2="12" y2="21" />
      <line x1="8" y1="21" x2="16" y2="21" />
    </svg>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${className ?? ""} animate-spin`}
      aria-hidden
    >
      <path d="M12 2v4" />
      <path d="M12 18v4" />
      <path d="M4.93 4.93l2.83 2.83" />
      <path d="M16.24 16.24l2.83 2.83" />
      <path d="M2 12h4" />
      <path d="M18 12h4" />
      <path d="M4.93 19.07l2.83-2.83" />
      <path d="M16.24 7.76l2.83-2.83" />
    </svg>
  );
}
