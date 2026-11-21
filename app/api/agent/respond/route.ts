import { z } from "zod";
import { financialToolNames } from "@/lib/financial-agent";
import { explainFinancialToolResult } from "@/lib/llm/provider";

export const runtime = "nodejs";

const requestSchema = z.object({
  consent: z.literal(true),
  question: z.string().trim().min(1).max(1000),
  tool: z.enum(financialToolNames),
  analysisContext: z.string().max(8000).optional(),
  toolResult: z.string().min(2).max(12_000).superRefine((value, context) => {
    try {
      JSON.parse(value);
    } catch {
      context.addIssue({ code: "custom", message: "Tool results must be valid JSON." });
    }
  })
}).strict();

export async function POST(request: Request) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Send a valid JSON request." }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return Response.json({ error: "The request is invalid or AI data-sharing consent was not provided." }, { status: 400 });
  try {
    const explanation = await explainFinancialToolResult(
      parsed.data.question,
      parsed.data.tool,
      parsed.data.toolResult,
      parsed.data.analysisContext
    );
    return Response.json({
      explanation,
      provider: "ollama"
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Ollama is unavailable. The local financial calculation is still ready." }, { status: 502 });
  }
}
