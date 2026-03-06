import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { clsx } from "clsx";

// ---------- Types for the Web Speech API ----------
// These are not universally available in all TS lib targets, so we declare
// the minimum surface we need.

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  onaudiostart: (() => void) | null;
  onaudioend: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

// ---------- Helpers ----------

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  const w = window as unknown as Record<string, unknown>;
  return (
    (w.SpeechRecognition as SpeechRecognitionCtor | undefined) ??
    (w.webkitSpeechRecognition as SpeechRecognitionCtor | undefined) ??
    null
  );
}

// ---------- Props ----------

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

// ---------- Component ----------

export function VoiceInput({ onTranscript, disabled }: VoiceInputProps) {
  const [supported, setSupported] = useState(true);
  const [recording, setRecording] = useState(false);
  const [interim, setInterim] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const finalTranscriptRef = useRef("");

  // Check browser support on mount
  useEffect(() => {
    if (!getSpeechRecognition()) {
      setSupported(false);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudioAnalysis();
      recognitionRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Audio level analysis (visual indicator) ----

  const startAudioAnalysis = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.7;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteFrequencyData(dataArray);
        // Compute RMS-ish average of lower frequency bins (voice range)
        const slice = dataArray.slice(0, 40);
        const sum = slice.reduce((a, v) => a + v, 0);
        const avg = sum / slice.length;
        // Normalise to 0-1
        setAudioLevel(Math.min(avg / 128, 1));
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Microphone access denied or unavailable — non-critical for STT
      setAudioLevel(0);
    }
  }, []);

  const stopAudioAnalysis = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    analyserRef.current = null;
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  // ---- Recognition lifecycle ----

  const startRecording = useCallback(() => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";

    finalTranscriptRef.current = "";
    setInterim("");

    recognition.onstart = () => {
      setRecording(true);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalText = "";
      let interimText = "";

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }

      if (finalText) {
        finalTranscriptRef.current = finalText;
      }
      setInterim(interimText);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // "aborted" is expected when we call stop/abort
      if (event.error !== "aborted") {
        console.warn("[VoiceInput] SpeechRecognition error:", event.error);
      }
    };

    recognition.onend = () => {
      setRecording(false);
      const transcript = (finalTranscriptRef.current + " " + interim).trim();
      // Deliver whatever we collected
      if (transcript) {
        onTranscript(transcript);
      }
      setInterim("");
      stopAudioAnalysis();
    };

    recognitionRef.current = recognition;
    recognition.start();
    startAudioAnalysis();
  }, [onTranscript, interim, startAudioAnalysis, stopAudioAnalysis]);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const toggle = useCallback(() => {
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [recording, startRecording, stopRecording]);

  // ---- Render ----

  if (!supported) {
    return (
      <button
        disabled
        className="text-text-tertiary p-1.5 rounded-lg shrink-0 mb-0.5 cursor-not-allowed opacity-50"
        title="Speech recognition is not supported in this browser"
      >
        <MicOff className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="relative shrink-0 mb-0.5">
      {/* Audio level ring — visible when recording */}
      {recording && (
        <span
          className="absolute inset-0 rounded-lg bg-danger/20 animate-pulse pointer-events-none"
          style={{
            transform: `scale(${1 + audioLevel * 0.45})`,
            opacity: 0.5 + audioLevel * 0.5,
            transition: "transform 0.1s ease-out, opacity 0.1s ease-out",
          }}
        />
      )}

      <button
        onClick={toggle}
        disabled={disabled}
        className={clsx(
          "relative z-10 p-1.5 rounded-lg transition-colors",
          recording
            ? "text-danger hover:text-danger/80 bg-danger/10"
            : "text-text-tertiary hover:text-text-secondary hover:bg-surface-tertiary",
          disabled && "opacity-50 cursor-not-allowed",
        )}
        title={recording ? "Stop recording" : "Voice input"}
      >
        {recording ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </button>

      {/* Interim transcription bubble */}
      {recording && interim && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[240px] px-3 py-1.5 rounded-lg bg-surface-secondary border border-border text-xs text-text shadow-md whitespace-pre-wrap">
          {interim}
        </div>
      )}
    </div>
  );
}
