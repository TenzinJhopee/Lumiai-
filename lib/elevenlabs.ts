import { z } from "zod";

export const MAX_VOICE_UPLOAD_BYTES = 10 * 1024 * 1024;
const transcriptionSchema = z.object({ text: z.string().trim().min(1).max(10_000) });
const MAX_SPEECH_RESPONSE_BYTES = 15 * 1024 * 1024;

export async function transcribeWithElevenLabs(audio: Blob, apiKey: string, fetcher: typeof fetch = fetch): Promise<string> {
  if (!audio.size || audio.size > MAX_VOICE_UPLOAD_BYTES) {
    throw new Error("Audio must be between 1 byte and 10 MB.");
  }
  const form = new FormData();
  const extension = audio.type.toLowerCase().includes("mp4") ? "mp4" : audio.type.toLowerCase().includes("ogg") ? "ogg" : "webm";
  form.append("file", audio, `recording.${extension}`);
  form.append("model_id", "scribe_v3");
  const response = await fetcher("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: form,
    signal: AbortSignal.timeout(45_000)
  });
  if (!response.ok) throw new Error("ElevenLabs transcription failed.");
  const parsed = transcriptionSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("ElevenLabs returned an invalid transcription.");
  return parsed.data.text;
}

export async function speakWithElevenLabs(text: string, voiceId: string, apiKey: string, fetcher: typeof fetch = fetch): Promise<ArrayBuffer> {
  const response = await fetcher(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg"
    },
    body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }),
    signal: AbortSignal.timeout(45_000)
  });
  if (!response.ok) {
    let detail = "";
    try {
      const payload = await response.json() as { detail?: { message?: string } | string };
      detail = typeof payload.detail === "string" ? payload.detail : payload.detail?.message || "";
    } catch {
      // Keep the generic provider error when ElevenLabs does not return JSON.
    }
    throw new Error(detail ? `ElevenLabs speech generation failed: ${detail}` : "ElevenLabs speech generation failed.");
  }
  if (!response.headers.get("content-type")?.toLowerCase().startsWith("audio/")) {
    throw new Error("ElevenLabs returned an unsupported audio format.");
  }
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > MAX_SPEECH_RESPONSE_BYTES) throw new Error("Generated speech is larger than the allowed response size.");
  const audio = await response.arrayBuffer();
  if (!audio.byteLength || audio.byteLength > MAX_SPEECH_RESPONSE_BYTES) throw new Error("ElevenLabs returned invalid audio.");
  return audio;
}
