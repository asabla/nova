import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, Loader2, AudioLines, Send, X } from "lucide-react";
import { clsx } from "clsx";
import { useTranslation } from "react-i18next";

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

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ---------- Mode ----------

type VoiceMode = "speech-to-text" | "audio-record";

// ---------- Props ----------

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  /** Called when the user records and sends an audio file */
  onAudioFile?: (file: File) => void;
  disabled?: boolean;
}

// ---------- Waveform Visualization ----------

function WaveformVisualizer({ analyser }: { analyser: AnalyserNode | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    if (!analyser || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const draw = () => {
      analyser.getByteTimeDomainData(dataArray);
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      ctx.lineWidth = 2;
      ctx.strokeStyle = "var(--color-danger, #ef4444)";
      ctx.beginPath();

      const sliceWidth = width / dataArray.length;
      let x = 0;

      for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * height) / 2;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }

      ctx.lineTo(width, height / 2);
      ctx.stroke();
      animRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      if (animRef.current !== null) {
        cancelAnimationFrame(animRef.current);
      }
    };
  }, [analyser]);

  return (
    <canvas
      ref={canvasRef}
      width={120}
      height={32}
      className="rounded bg-surface-secondary/50"
    />
  );
}

// ---------- Component ----------

export function VoiceInput({ onTranscript, onAudioFile, disabled }: VoiceInputProps) {
  const { t } = useTranslation();
  const [supported, setSupported] = useState(true);
  const [mode, setMode] = useState<VoiceMode>("speech-to-text");
  const [recording, setRecording] = useState(false);
  const [interim, setInterim] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);
  const [duration, setDuration] = useState(0);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const finalTranscriptRef = useRef("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sttSupported = !!getSpeechRecognition();
  const mediaRecorderSupported = typeof MediaRecorder !== "undefined";

  // Check browser support on mount
  useEffect(() => {
    if (!sttSupported && !mediaRecorderSupported) {
      setSupported(false);
    }
    // Default to whichever mode is available
    if (!sttSupported && mediaRecorderSupported) {
      setMode("audio-record");
    }
  }, [sttSupported, mediaRecorderSupported]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudioAnalysis();
      recognitionRef.current?.abort();
      mediaRecorderRef.current?.stop();
      stopDurationTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Duration timer ----

  const startDurationTimer = useCallback(() => {
    setDuration(0);
    durationIntervalRef.current = setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);
  }, []);

  const stopDurationTimer = useCallback(() => {
    if (durationIntervalRef.current !== null) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  // ---- Audio level analysis (visual indicator) ----

  const startAudioAnalysis = useCallback(async (existingStream?: MediaStream) => {
    try {
      const stream =
        existingStream ?? (await navigator.mediaDevices.getUserMedia({ audio: true }));
      if (!existingStream) {
        streamRef.current = stream;
      }

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

  // ---- Speech-to-text recognition lifecycle ----

  const startSTT = useCallback(() => {
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
      stopDurationTimer();
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
    startDurationTimer();
  }, [onTranscript, interim, startAudioAnalysis, stopAudioAnalysis, startDurationTimer, stopDurationTimer]);

  const stopSTT = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  // ---- Audio recording lifecycle ----

  const startAudioRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const ext = mimeType.includes("webm") ? "webm" : "ogg";
        const file = new File([blob], `voice-recording-${Date.now()}.${ext}`, {
          type: mimeType,
        });
        if (onAudioFile) {
          onAudioFile(file);
        }
        audioChunksRef.current = [];
        stopAudioAnalysis();
        stopDurationTimer();
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250); // collect data every 250ms
      setRecording(true);
      startAudioAnalysis(stream);
      startDurationTimer();
    } catch (err) {
      console.warn("[VoiceInput] Could not start audio recording:", err);
    }
  }, [onAudioFile, startAudioAnalysis, stopAudioAnalysis, startDurationTimer, stopDurationTimer]);

  const stopAudioRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  }, []);

  const cancelAudioRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    audioChunksRef.current = [];
    stopAudioAnalysis();
    stopDurationTimer();
    setRecording(false);
    setDuration(0);
  }, [stopAudioAnalysis, stopDurationTimer]);

  // ---- Unified toggle ----

  const toggle = useCallback(() => {
    if (recording) {
      if (mode === "speech-to-text") {
        stopSTT();
      } else {
        stopAudioRecording();
      }
    } else {
      if (mode === "speech-to-text") {
        startSTT();
      } else {
        startAudioRecording();
      }
    }
  }, [recording, mode, startSTT, stopSTT, startAudioRecording, stopAudioRecording]);

  const cycleMode = useCallback(() => {
    if (recording) return; // Don't switch while recording
    if (!sttSupported || !mediaRecorderSupported) return; // Only one mode available
    setMode((m) => (m === "speech-to-text" ? "audio-record" : "speech-to-text"));
  }, [recording, sttSupported, mediaRecorderSupported]);

  // ---- Render ----

  if (!supported) {
    return (
      <button
        disabled
        className="text-text-tertiary p-1.5 rounded-lg shrink-0 mb-0.5 cursor-not-allowed opacity-50"
        aria-label={t("voice.unsupported", { defaultValue: "Speech recognition is not supported in this browser" })}
      >
        <MicOff className="h-4 w-4" />
      </button>
    );
  }

  // While recording audio, show an expanded control bar
  if (recording && mode === "audio-record") {
    return (
      <div className="flex items-center gap-2 shrink-0 mb-0.5">
        {/* Cancel button */}
        <button
          onClick={cancelAudioRecording}
          className="text-text-tertiary hover:text-danger p-1.5 rounded-lg transition-colors"
          aria-label={t("voice.cancelRecording", { defaultValue: "Cancel recording" })}
        >
          <X className="h-4 w-4" />
        </button>

        {/* Pulsing red dot + duration */}
        <div className="flex items-center gap-1.5 text-xs text-danger font-medium">
          <span className="h-2 w-2 rounded-full bg-danger animate-pulse" />
          {formatDuration(duration)}
        </div>

        {/* Waveform */}
        <WaveformVisualizer analyser={analyserRef.current} />

        {/* Send button */}
        <button
          onClick={stopAudioRecording}
          className="text-primary hover:text-primary/80 p-1.5 rounded-lg bg-primary/10 transition-colors"
          aria-label={t("voice.sendRecording", { defaultValue: "Send audio recording" })}
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative shrink-0 mb-0.5 flex items-center gap-0.5">
      {/* Mode toggle — only show when both modes are available and not recording */}
      {sttSupported && mediaRecorderSupported && !recording && (
        <button
          onClick={cycleMode}
          disabled={disabled}
          className={clsx(
            "p-1 rounded-lg text-text-tertiary hover:text-text-secondary transition-colors",
            disabled && "opacity-50 cursor-not-allowed",
          )}
          aria-label={
            mode === "speech-to-text"
              ? t("voice.modeStt", { defaultValue: "Mode: Speech-to-text (click to switch to audio recording)" })
              : t("voice.modeAudio", { defaultValue: "Mode: Audio recording (click to switch to speech-to-text)" })
          }
        >
          <AudioLines className="h-3.5 w-3.5" />
        </button>
      )}

      <div className="relative">
        {/* Audio level ring — visible when recording STT */}
        {recording && mode === "speech-to-text" && (
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
          aria-label={
            recording
              ? t("voice.stopRecording", { defaultValue: "Stop recording" })
              : mode === "speech-to-text"
                ? t("voice.startStt", { defaultValue: "Voice input (speech-to-text)" })
                : t("voice.startAudio", { defaultValue: "Record audio message" })
          }
        >
          {recording ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </button>

        {/* Recording duration for STT mode */}
        {recording && mode === "speech-to-text" && (
          <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-danger font-medium whitespace-nowrap flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-danger animate-pulse" />
            {formatDuration(duration)}
          </span>
        )}

        {/* Interim transcription bubble */}
        {recording && mode === "speech-to-text" && interim && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-7 w-max max-w-[240px] px-3 py-1.5 rounded-lg bg-surface-secondary border border-border text-xs text-text shadow-md whitespace-pre-wrap">
            {interim}
          </div>
        )}
      </div>
    </div>
  );
}
