import { z } from "zod";
import { financialAgentSystemPrompt } from "@/lib/agent-prompt";
import type { FinancialToolName } from "@/lib/financial-agent";

const chatResponseSchema = z.object({
  message: z.object({ content: z.string().max(4000) })
});
const tagsResponseSchema = z.object({
  models: z.array(z.object({ name: z.string() }))
});

const localProviderHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
const defaultModel = "qwen2.5:3b";

export class LlmProviderError extends Error {
  constructor() {
    super("The local Ollama provider could not complete the request.");
    this.name = "LlmProviderError";
  }
}

function getOllamaConfig() {
  const baseUrl = process.env.OLLAMA_BASE_URL?.trim() || "http://localhost:11434";
  const model = process.env.OLLAMA_MODEL?.trim() || defaultModel;
  try {
    const base = new URL(baseUrl);
    if (base.protocol !== "http:" || !localProviderHosts.has(base.hostname) || base.username || base.password) {
      throw new Error("Ollama must be configured on this device.");
    }
    base.pathname = "/";
    base.search = "";
    base.hash = "";
    return { base, model };
  } catch {
    throw new LlmProviderError();
  }
}

export async function getOllamaConnectionStatus() {
  const { base, model } = getOllamaConfig();
  try {
    const response = await fetch(new URL("/api/tags", base), {
      signal: AbortSignal.timeout(2500),
      cache: "no-store"
    });
    if (!response.ok) return { connected: false, model };
    const parsed = tagsResponseSchema.safeParse(await response.json());
    return {
      connected: parsed.success && parsed.data.models.some((item) => item.name === model),
      model
    };
  } catch {
    return { connected: false, model };
  }
}

export async function explainFinancialToolResult(
  question: string,
  tool: FinancialToolName,
  toolResult: string,
  analysisContext?: string
): Promise<string> {
  const { base, model } = getOllamaConfig();
  const analysisSummary = analysisContext?.trim()
    ? `\nCurrent financial analysis snapshot (verified local aggregates): ${analysisContext}`
    : "";
  let response: Response;
  try {
    response = await fetch(new URL("/api/chat", base), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        options: { temperature: 0.2 },
        messages: [
          { role: "system", content: financialAgentSystemPrompt },
          { role: "user", content: `User question: ${question}\nSelected deterministic tool: ${tool}\nTool result (verified, JSON): ${toolResult}${analysisSummary}` }
        ]
      }),
      signal: AbortSignal.timeout(120_000),
      cache: "no-store"
    });
  } catch {
    throw new LlmProviderError();
  }
  if (!response.ok) throw new LlmProviderError();

  let content: string;
  try {
    const parsed = chatResponseSchema.safeParse(await response.json());
    content = parsed.success ? parsed.data.message.content.trim() : "";
  } catch {
    throw new LlmProviderError();
  }
  if (!content || content.length > 2000) throw new LlmProviderError();

  const numberWords = "one|two|three|four|five|six|seven|eight|nine|ten|hundred|thousand|million";
  const measurableUnits = "days?|weeks?|months?|years?|transactions?|categories|payments?|subscriptions?|percent(?:age)?|per cent|francs?|euros?|dollars?";
  const unsupportedFigure = new RegExp(
    `(?:\\d|%|\\b(?:CHF|EUR|USD|francs?|euros?|dollars?)\\b|\\b(?:${numberWords})\\s+(?:\\w+\\s+){0,2}(?:${measurableUnits})\\b)`,
    "i"
  );
  const unsupportedActionOffer = /\b(?:would you like|do you want|shall i)\b.*\b(?:set up|transfer|move|change|cancel|manage|pay)\b|^\s*if so,?\s*(?:i can|i will|i'll)\b/i;
  const safeNarrative = content
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !unsupportedFigure.test(sentence) && !unsupportedActionOffer.test(sentence))
    .join(" ")
    .trim();
  return safeNarrative || "Here’s what your records show.";
}
