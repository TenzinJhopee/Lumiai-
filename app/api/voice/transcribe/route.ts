import { MAX_VOICE_UPLOAD_BYTES, transcribeWithElevenLabs } from "@/lib/elevenlabs";

export const runtime = "nodejs";

const acceptedAudioTypes = new Set([
  "audio/webm",
  "audio/webm;codecs=opus",
  "audio/ogg",
  "audio/ogg;codecs=opus",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/aac"
]);

export async function POST(request: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return Response.json({ error: "Voice transcription is not configured. You can type your question instead." }, { status: 503 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Send an audio recording as multipart form data." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "An audio file is required." }, { status: 400 });
  if (!acceptedAudioTypes.has(file.type.toLowerCase())) return Response.json({ error: "Use a supported audio format (WebM, Ogg, MP4, WAV, MP3, or AAC)." }, { status: 415 });
  if (!file.size || file.size > MAX_VOICE_UPLOAD_BYTES) return Response.json({ error: "Audio must be between 1 byte and 10 MB." }, { status: 413 });

  try {
    const text = await transcribeWithElevenLabs(file, apiKey);
    return Response.json({ text }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Transcription failed. Please try again or type your question." }, { status: 502 });
  }
}
