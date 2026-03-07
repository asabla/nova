import { Hono } from "hono";
import type { AppContext } from "../types/context";
import { env } from "../lib/env";
import { AppError } from "@nova/shared/utils";

const voiceRoutes = new Hono<AppContext>();

/**
 * POST /transcribe - Transcribe an audio file using LiteLLM/Whisper (Stories #227, #229)
 * Accepts multipart/form-data with an "audio" field containing the audio file.
 */
voiceRoutes.post("/transcribe", async (c) => {
  const body = await c.req.parseBody();
  const audio = body["audio"];

  if (!audio || !(audio instanceof File)) {
    throw AppError.badRequest("Missing audio file. Send multipart/form-data with an 'audio' field.");
  }

  // Validate file size (max 25MB, Whisper limit)
  if (audio.size > 25 * 1024 * 1024) {
    throw AppError.badRequest("Audio file too large. Maximum 25MB.");
  }

  // Validate audio MIME type
  const allowedAudioTypes = [
    "audio/webm", "audio/ogg", "audio/mpeg", "audio/mp3", "audio/mp4",
    "audio/wav", "audio/x-wav", "audio/flac", "audio/m4a",
  ];
  if (!allowedAudioTypes.some((t) => audio.type.startsWith(t.split("/")[0]))) {
    throw AppError.badRequest(`Unsupported audio type: ${audio.type}`);
  }

  const language = (body["language"] as string) ?? undefined;
  const model = (body["model"] as string) ?? "whisper-1";

  // Forward to LiteLLM /audio/transcriptions (OpenAI-compatible)
  const formData = new FormData();
  formData.append("file", audio, audio.name || "audio.webm");
  formData.append("model", model);
  if (language) formData.append("language", language);

  const response = await fetch(`${env.LITELLM_API_URL}/audio/transcriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.LITELLM_MASTER_KEY}`,
    },
    body: formData,
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new AppError(502, "Transcription Failed", errorText);
  }

  const result = await response.json() as { text: string };
  return c.json({ text: result.text, model });
});

/**
 * POST /tts - Generate speech from text using LiteLLM/TTS (Story #228)
 * Returns audio/mpeg stream.
 */
voiceRoutes.post("/tts", async (c) => {
  const body = await c.req.json();
  const text = body.text as string;
  const voice = (body.voice as string) ?? "alloy";
  const model = (body.model as string) ?? "tts-1";
  const speed = (body.speed as number) ?? 1.0;

  if (!text || text.length === 0) {
    throw AppError.badRequest("Missing 'text' field");
  }

  if (text.length > 4096) {
    throw AppError.badRequest("Text too long. Maximum 4096 characters.");
  }

  const response = await fetch(`${env.LITELLM_API_URL}/audio/speech`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.LITELLM_MASTER_KEY}`,
    },
    body: JSON.stringify({ model, input: text, voice, speed }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok || !response.body) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new AppError(502, "TTS Failed", errorText);
  }

  c.header("Content-Type", "audio/mpeg");
  c.header("Content-Disposition", `inline; filename="speech.mp3"`);
  return new Response(response.body, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-cache",
    },
  });
});

export { voiceRoutes };
