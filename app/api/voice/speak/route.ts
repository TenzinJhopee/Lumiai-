import { z } from "zod";
import { speakWithElevenLabs } from "@/lib/elevenlabs";

export const runtime = "nodejs";

const DEFAULT_ELEVENLABS_VOICE_ID = "nPczCjzI2devNBz1zQrb";

const requestSchema = z.object({
  text: z.string().trim().min(1).max(4000)
}).strict();

export async function POST(request: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return Response.json({ error: "Speech generation is not configured. The text response is still available." }, { status: 503 });

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Send a JSON body containing text." }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return Response.json({ error: "Text must contain between 1 and 4,000 characters." }, { status: 400 });

  try {
    const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim() || DEFAULT_ELEVENLABS_VOICE_ID;
    const audio = await speakWithElevenLabs(parsed.data.text, voiceId, apiKey);
    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audio.byteLength),
        "Cache-Control": "no-store"
      }
    });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "ElevenLabs speech generation failed.";
    return Response.json(
      { error: `${message} The text response is still available.` },
      { status: 502 }
    );
  }
}
