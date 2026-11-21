"use client";

import { useEffect, useRef, useState } from "react";
import { AudioLines, Bot, FileUp, LoaderCircle, Mic, Plus, Send, ShieldCheck, Sparkles, Square, Volume2 } from "lucide-react";
import { FinancialAnswerVisual } from "@/components/financial-answer-visual";
import { buildAssistantAnalysisContext } from "@/lib/assistant-analysis-context";
import { create_budget } from "@/lib/financial-tools";
import { executeFinancialTool, selectFinancialTool } from "@/lib/financial-agent";
import { formatMoney } from "@/lib/finance";
import { createFinancialVisualization } from "@/lib/financial-visualization";
import type { FinancialVisualization } from "@/lib/financial-visualization";
import { microphoneErrorMessage } from "@/lib/voice-errors";
import type { Budget, Investment, SavingsTarget, Transaction, UpcomingBill } from "@/lib/models";
import type { FinancialToolName } from "@/lib/financial-agent";

interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  text: string;
  verifiedAnswer?: string;
  visualization?: FinancialVisualization;
  tool?: FinancialToolName;
  audioUrl?: string;
}

interface FinancialAgentProps {
  transactions: Transaction[];
  currency: string;
  budgets: Budget[];
  investments: Investment[];
  bills: UpcomingBill[];
  savingsTarget?: SavingsTarget;
  onCreateBudgets: (values: Budget[]) => Promise<void>;
  onOpenImport: () => void;
}

const suggestedQuestions = [
  "How much did I spend this month?",
  "What are my three biggest spending categories?",
  "How much could I save each month?",
  "Forecast my cash flow for the next three months."
];

type OllamaStatus = {
  connected: boolean;
  model: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function listValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function formatToolAnswer(tool: FinancialToolName, value: unknown, currency: string) {
  if (tool === "get_recurring_payments" || tool === "get_savings_opportunities") {
    const items = listValue(value).filter(isRecord);
    if (!items.length) return tool === "get_recurring_payments"
      ? "No recurring-payment pattern met the minimum evidence threshold in the imported transactions."
      : "No savings opportunity met the current evidence thresholds. Importing more history may reveal additional patterns.";
    return items.slice(0, 4).map((item) => {
      if (tool === "get_recurring_payments") {
        return `${stringValue(item.name, "Payment")}: about ${formatMoney(numberValue(item.monthlyAmount), currency)} per month (${stringValue(item.cadence)} pattern, ${numberValue(item.occurrenceCount)} observations).`;
      }
      return `${stringValue(item.title, "Opportunity")}: estimated ${formatMoney(numberValue(item.monthlySavings), currency)} per month. Assumption: ${stringValue(item.assumption, "Illustrative only.")}`;
    }).join("\n");
  }

  const data = isRecord(value) ? value : {};
  switch (tool) {
    case "get_financial_summary":
      return `Across ${numberValue(data.monthsAnalyzed)} imported month(s), recorded income was ${formatMoney(numberValue(data.income), currency)}, expenses were ${formatMoney(numberValue(data.expenses), currency)}, and net cash flow was ${formatMoney(numberValue(data.netCashFlow), currency)}. Average monthly savings were ${formatMoney(numberValue(data.monthlySavings), currency)} (${Math.round(numberValue(data.savingsRate) * 100)}%). A confirmed account balance is not available from transaction data.`;
    case "get_monthly_spending":
      return `${stringValue(data.month, "The latest imported month")}: net consumer expenses were ${formatMoney(numberValue(data.netExpenses), currency)} after ${formatMoney(numberValue(data.refunds), currency)} in refunds. Recorded income was ${formatMoney(numberValue(data.income), currency)}; transfers are excluded.`;
    case "get_spending_by_category": {
      const categories = listValue(data.categories).filter(isRecord).slice(0, 3);
      return categories.length
        ? `Spending by category for ${stringValue(data.month, "the latest imported month")}:\n${categories.map((item) => `${stringValue(item.name, "Other")}: ${formatMoney(numberValue(item.value), currency)}`).join("\n")}`
        : "There is no category-level expense data for the latest imported month.";
    }
    case "create_budget": {
      const budgets = listValue(data.budgets).filter(isRecord);
      if (!budgets.length) return `There are no new category limits to create for ${stringValue(data.targetMonth, "next month")}. Existing limits are left unchanged.`;
      return `I saved a suggested budget for ${stringValue(data.targetMonth, "next month")}:\n${budgets.map((item) => `${stringValue(item.category, "Other")}: ${formatMoney(numberValue(item.monthlyLimit), currency)} monthly`).join("\n")}\n${stringValue(data.assumptions)}`;
    }
    case "get_budget_status": {
      const statuses = listValue(data.budgets).filter(isRecord);
      return statuses.length
        ? `Budget status for ${stringValue(data.month, "the latest imported month")}:\n${statuses.map((item) => `${stringValue(item.category, "Category")}: ${formatMoney(numberValue(item.actualSpending), currency)} of ${formatMoney(numberValue(item.monthlyLimit), currency)}${item.isOverBudget === true ? `, ${formatMoney(numberValue(item.overspent), currency)} over` : `, ${formatMoney(numberValue(item.remaining), currency)} remaining`}`).join("\n")}`
        : "No saved budget limits are available for this currency.";
    }
    case "get_cashflow_forecast": {
      const horizons = listValue(data.horizons).filter(isRecord);
      if (!horizons.length) return "There is not enough imported information to produce a cash-flow estimate.";
      return `Estimated net flow (not a balance):\n${horizons.map((item) => `${numberValue(item.days)} days: income ${formatMoney(numberValue(item.projectedIncome), currency)}, expenses ${formatMoney(numberValue(item.projectedExpenses), currency)}, net ${formatMoney(numberValue(item.projectedNetFlow), currency)}; known bills ${formatMoney(numberValue(item.knownBills), currency)}.`).join("\n")}\n${listValue(data.assumptions).filter((item): item is string => typeof item === "string").join(" ")}`;
    }
    case "get_investment_portfolio":
    case "calculate_investment_performance":
      return `Manually priced portfolio in ${currency}: invested ${formatMoney(numberValue(data.totalInvested), currency)}, current entered value ${formatMoney(numberValue(data.currentValue), currency)}, unrealised change ${formatMoney(numberValue(data.unrealizedProfitLoss), currency)} (${numberValue(data.returnPercent).toFixed(2)}%). These values use user-entered prices, not live market data.`;
  }
}

function minimizeForProvider(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(minimizeForProvider);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !["id", "transactionIds", "account", "sourceFile"].includes(key))
    .map(([key, child]) => [key, minimizeForProvider(child)]));
}

export function FinancialAgent({ transactions, currency, budgets, investments, bills, savingsTarget, onCreateBudgets, onOpenImport }: FinancialAgentProps) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: "welcome",
    role: "assistant",
    text: "Hello. I’m the PostFinance Financial Intelligence Agent, an independent prototype. I can answer with calculations from your imported activity. Local Ollama is used for model assistance; exact figures stay on this device."
  }]);
  const [sharingConsent, setSharingConsent] = useState(true);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [aiVoiceEnabled, setAiVoiceEnabled] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const audioUrls = useRef<string[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const audioElements = useRef(new Map<string, HTMLAudioElement>());

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy, transcribing]);

  useEffect(() => {
    let active = true;
    const refreshStatus = async () => {
      try {
        const response = await fetch("/api/agent/status", { cache: "no-store" });
        if (!response.ok) throw new Error("Status request failed.");
        const status = await response.json() as OllamaStatus;
        if (active) setOllamaStatus(status);
      } catch {
        if (active) setOllamaStatus({ connected: false, model: "qwen2.5:3b" });
      }
    };
    void refreshStatus();
    const interval = window.setInterval(() => void refreshStatus(), 30_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => () => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    audioUrls.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  async function submitQuestion(rawQuestion: string, fromVoice = false) {
    const prompt = rawQuestion.trim().slice(0, 1000);
    if (!prompt || busy) return;
    setBusy(true);
    setError("");
    setQuestion("");
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", text: prompt };
    const responseId = crypto.randomUUID();
    setMessages((current) => [...current, userMessage]);

    try {
      const tool = selectFinancialTool(prompt);
      const context = { transactions, currency, budgets, investments, bills };
      let result: unknown;
      if (tool === "create_budget") {
        const draft = create_budget(transactions, currency, budgets);
        result = draft;
        await onCreateBudgets(draft.budgets);
      } else result = executeFinancialTool(tool, context);
      const verifiedAnswer = formatToolAnswer(tool, result, currency);
      const visualization = createFinancialVisualization(tool, result, currency);
      let explanation = "Here’s what I found.";

      if (sharingConsent) {
        try {
          const response = await fetch("/api/agent/respond", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              consent: true,
              question: prompt,
              tool,
              toolResult: JSON.stringify(minimizeForProvider(result)),
              analysisContext: JSON.stringify(buildAssistantAnalysisContext({
                transactions,
                currency,
                budgets,
                investments,
                bills,
                savingsTarget
              }))
            })
          });
          const payload = await response.json() as { explanation?: string; error?: string };
          if (!response.ok) throw new Error(payload.error || "The language model is unavailable.");
          explanation = payload.explanation || explanation;
        } catch (reason) {
          setError(reason instanceof Error ? `${reason.message} Using the verified local answer instead.` : "The language model is unavailable. Using the verified local answer instead.");
        }
      }

      const assistantMessage: ChatMessage = {
        id: responseId,
        role: "assistant",
        text: explanation,
        verifiedAnswer,
        visualization,
        tool
      };
      setMessages((current) => [...current, assistantMessage]);
      if (fromVoice || aiVoiceEnabled) void synthesizeSpeech(responseId, `${explanation} ${verifiedAnswer}`, true);
    } catch (reason) {
      setMessages((current) => [...current, {
        id: responseId,
        role: "assistant",
        text: reason instanceof Error ? `I couldn’t complete that action: ${reason.message}` : "I couldn’t complete that action. Please try again."
      }]);
    } finally {
      setBusy(false);
    }
  }

  async function transcribeRecording(blob: Blob) {
    setTranscribing(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", blob, "recording.webm");
      const response = await fetch("/api/voice/transcribe", { method: "POST", body: form });
      const payload = await response.json() as { text?: string; error?: string };
      if (!response.ok || !payload.text) throw new Error(payload.error || "Transcription failed.");
      setQuestion(payload.text);
      await submitQuestion(payload.text, true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Voice transcription failed. You can type your question instead.");
    } finally {
      setTranscribing(false);
    }
  }

  async function startRecording() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Audio recording is not supported in this browser. You can type your question instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunks.current = [];
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size) audioChunks.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        const audio = new Blob(audioChunks.current, { type: recorder.mimeType || "audio/webm" });
        if (audio.size > 10 * 1024 * 1024) {
          setError("This recording is over the 10 MB limit. Please record a shorter question.");
          return;
        }
        void transcribeRecording(audio);
      };
      recorder.start();
      setRecording(true);
    } catch (reason) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setError(microphoneErrorMessage(reason));
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    setRecording(false);
  }

  async function synthesizeSpeech(messageId: string, text: string, autoPlay = false) {
    setVoiceBusy(true);
    setError("");
    try {
      const response = await fetch("/api/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.slice(0, 4000) })
      });
      if (!response.ok) {
        let payloadMessage = "Speech generation failed.";
        try {
          const payload = await response.json() as { error?: string };
          payloadMessage = payload.error || payloadMessage;
        } catch {
          // Use the generic message if the provider route did not return JSON.
        }
        if ("speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text.slice(0, 4000));
          utterance.lang = navigator.language || "en-GB";
          utterance.onend = () => setVoiceBusy(false);
          utterance.onerror = () => {
            setError(`Browser speech could not start. ${payloadMessage} The text response is still available.`);
            setVoiceBusy(false);
          };
          window.speechSynthesis.speak(utterance);
          setError(`ElevenLabs TTS unavailable: ${payloadMessage} Using your browser's voice instead.`);
          if (!autoPlay) setVoiceBusy(false);
          return;
        }
        throw new Error(payloadMessage);
      }
      const url = URL.createObjectURL(await response.blob());
      audioUrls.current.push(url);
      setMessages((current) => current.map((message) => message.id === messageId ? { ...message, audioUrl: url } : message));
      if (autoPlay) {
        window.setTimeout(() => {
          void audioElements.current.get(messageId)?.play().catch(() => {
            setError("Audio is ready. Press Play to hear the response.");
          });
        }, 100);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Speech generation failed. The text response is still available.");
    } finally {
      setVoiceBusy(false);
    }
  }

  function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitQuestion(question);
  }

  return (
    <div className="ai-assistant-screen">
      <header className="relative z-10 flex h-[68px] shrink-0 items-center justify-between border-b border-white/5 px-4 sm:px-8">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-300/20 bg-violet-400/10 text-violet-200"><AudioLines size={18} /></span>
          <span className="text-sm font-semibold tracking-wide text-white">luma<span className="text-violet-300">.</span></span>
          <span className="hidden text-sm text-white/45 sm:inline">Financial assistant</span>
        </div>
        <div className="flex items-center gap-3">
          <span aria-live="polite" className="flex max-w-[174px] items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[10px] text-white/70 sm:max-w-none sm:px-3 sm:text-[11px]">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${ollamaStatus?.connected ? "bg-emerald-300 shadow-[0_0_10px_2px_rgba(110,255,181,0.4)]" : "bg-rose-300"}`} />
            <span className="min-w-0">
              <span className="block font-semibold">{ollamaStatus ? (ollamaStatus.connected ? "Connected" : "Disconnected") : "Checking Ollama"}</span>
              <span className="block truncate text-[8px] text-white/45 sm:text-[9px]">{ollamaStatus?.model ?? "qwen2.5:3b"}</span>
            </span>
          </span>
        </div>
      </header>

      <main className="relative z-10 flex min-h-0 flex-1 flex-col">
        {messages.length === 1
          ? <div className="flex flex-1 flex-col items-center justify-center px-4 pb-8 pt-4 text-center">
              <div aria-hidden="true" className="ai-assistant-orb mb-8 sm:mb-10" />
              <p className="mb-2 text-sm text-violet-200/65">Hello</p>
              <h1 className="max-w-2xl text-2xl font-light leading-tight tracking-tight text-white/85 sm:text-4xl">How can I assist you with your finances today?</h1>
              <p className="mt-3 max-w-lg text-xs leading-5 text-white/40 sm:text-sm">Ask about your spending, budgets, savings, or investments. Your exact figures come from local calculations.</p>
              <div className="mt-7 grid w-full max-w-[560px] grid-cols-1 gap-3 sm:mt-9 sm:grid-cols-2">
                {suggestedQuestions.map((item) => <button className="min-h-12 rounded-xl border border-violet-400/50 bg-black/20 px-4 py-3 text-left text-xs text-white/80 transition hover:border-violet-200 hover:bg-violet-400/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 sm:text-sm" disabled={busy || transcribing} key={item} onClick={() => void submitQuestion(item)} type="button"><Sparkles className="mr-2 inline text-violet-300" size={14} />{item}</button>)}
              </div>
            </div>
          : <div aria-live="polite" className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
              <div className="space-y-5">
                {messages.filter((message) => message.id !== "welcome").map((message) => (
                  <div className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`} key={message.id}>
                    <article className={`max-w-[94%] rounded-2xl px-4 py-3 sm:max-w-[88%] ${message.role === "user" ? "rounded-br-md border border-violet-300/20 bg-violet-500/15 text-white" : "rounded-bl-md border border-white/5 bg-white/[0.04] text-white/85"}`}>
                      <div className="mb-1.5 flex items-center gap-2 text-[10px] font-semibold text-white/45">{message.role === "user" ? "You" : <><Bot size={12} /> Luma</>}</div>
                      <p className="whitespace-pre-line text-sm leading-6">{message.text}</p>
                      {message.visualization && <FinancialAnswerVisual currency={currency} visualization={message.visualization} />}
                      {message.verifiedAnswer && <div className="mt-3 whitespace-pre-line rounded-xl border border-emerald-300/15 bg-emerald-300/[0.05] p-3 text-xs leading-5 text-white/75"><p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-200"><ShieldCheck size={12} /> Verified local calculation · {message.tool?.replaceAll("_", " ")}</p>{message.verifiedAnswer}</div>}
                      {message.role === "assistant" && message.verifiedAnswer && (
                        <div className="mt-3">
                          {message.audioUrl
                            ? <audio className="h-9 max-w-full" controls preload="none" ref={(element) => {if (element) audioElements.current.set(message.id, element); else audioElements.current.delete(message.id);}} src={message.audioUrl} />
                            : <button className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-white/55 transition hover:text-violet-200 disabled:opacity-50" disabled={voiceBusy} onClick={() => void synthesizeSpeech(message.id, `${message.text} ${message.verifiedAnswer}`)} type="button"><Volume2 size={14} /> {voiceBusy ? "Preparing audio…" : "Play response"}</button>}
                        </div>
                      )}
                    </article>
                  </div>
                ))}
                {(busy || transcribing) && <div className="flex justify-start"><div className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.04] px-4 py-3 text-xs text-white/55"><LoaderCircle className="animate-spin text-violet-300" size={14} />{transcribing ? "Transcribing audio…" : "Thinking through your finances…"}</div></div>}
                <div ref={chatEndRef} />
              </div>
            </div>}
      </main>

      <footer className="relative z-10 shrink-0 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-6">
        <div className="mx-auto max-w-3xl">
          {showSuggestions && messages.length > 1 && <div className="mb-3 flex flex-wrap gap-2">{suggestedQuestions.map((item) => <button className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-white/65 transition hover:border-violet-300/40 hover:text-white disabled:opacity-50" disabled={busy || transcribing} key={item} onClick={() => {setShowSuggestions(false);void submitQuestion(item);}} type="button">{item}</button>)}</div>}
          {error && <p className="mb-3 rounded-lg border border-amber-200/15 bg-amber-300/[0.08] px-3 py-2 text-xs leading-5 text-amber-100/85" role="alert">{error}</p>}
          {recording && <p aria-live="polite" className="mb-2 flex items-center gap-2 text-xs font-medium text-rose-200"><span className="h-2 w-2 animate-pulse rounded-full bg-rose-400" /> Listening · tap Stop to send your question</p>}
          {transcribing && <p aria-live="polite" className="mb-2 text-center text-xs text-violet-200/75">Transcribing your question…</p>}
          <form className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#15141c]/95 p-2 shadow-[0_14px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl focus-within:border-violet-300/45" onSubmit={submitForm}>
            <button aria-expanded={showSuggestions} aria-label={showSuggestions ? "Hide quick questions" : "Show quick questions"} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-violet-300 transition hover:bg-white/5 hover:text-violet-100" onClick={() => setShowSuggestions((current) => !current)} type="button"><Plus size={20} /></button>
            <button aria-label="Upload transaction CSV files" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-violet-300 transition hover:bg-white/5 hover:text-violet-100 disabled:opacity-40" disabled={busy || transcribing || recording} onClick={onOpenImport} title="Upload transaction CSV files" type="button"><FileUp size={18} /></button>
            <input aria-label="Ask the financial assistant" className="h-10 min-w-0 flex-1 bg-transparent px-1 text-sm text-white outline-none placeholder:text-white/40 disabled:opacity-50" disabled={busy || transcribing || recording} maxLength={1000} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => {if (event.key === "Enter" && !event.shiftKey) {event.preventDefault();void submitQuestion(question);}}} placeholder={recording ? "Listening…" : "Type your question here"} value={question} />
            {question.trim()
              ? <button aria-label="Send question" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#17131e] transition hover:bg-violet-100 disabled:opacity-40" disabled={busy || transcribing} type="submit"><Send size={17} /></button>
              : <button aria-label={recording ? "Finish voice question" : "Ask by voice"} aria-pressed={recording} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition ${recording ? "bg-rose-400 text-white" : "bg-white text-violet-600 hover:bg-violet-100"} disabled:opacity-40`} disabled={busy || transcribing} onClick={() => {if (recording) stopRecording(); else void startRecording();}} title={recording ? "Tap to send your question" : "Ask by voice"} type="button">{recording ? <Square size={15} fill="currentColor" /> : <Mic size={19} />}</button>}
          </form>
          <p className="mt-2 text-center text-[10px] text-white/40">{recording ? "Tap Stop when you’ve finished speaking." : "Tap the microphone to ask by voice. Your answer will be spoken aloud."}</p>
          <details className="group mt-3 text-[10px] text-white/45">
            <summary className="cursor-pointer list-none text-center transition hover:text-white/70">Voice &amp; assistant settings</summary>
            <div className="mt-3 grid gap-2 rounded-xl border border-white/10 bg-[#111018]/95 p-3 sm:grid-cols-2">
              <label className="flex items-start gap-2 leading-4">
                <input checked={aiVoiceEnabled} className="mt-0.5 accent-violet-400" id="agent-ai-voice" onChange={(event) => {const enabled = event.target.checked;setAiVoiceEnabled(enabled);if (!enabled && "speechSynthesis" in window) window.speechSynthesis.cancel();}} type="checkbox" />
                <span><span className="font-semibold text-white/75">AI voice</span> — uses ElevenLabs TTS when available, with a browser voice fallback.</span>
              </label>
              <label className="flex items-start gap-2 leading-4">
                <input checked={sharingConsent} className="mt-0.5 accent-violet-400" id="agent-sharing-consent" onChange={(event) => setSharingConsent(event.target.checked)} type="checkbox" />
                <span><span className="font-semibold text-white/75">Use local Ollama</span> — send your question, its calculation, and an aggregate summary of your saved finances to Qwen on this device. Raw rows, account IDs, and files are not sent.</span>
              </label>
            </div>
          </details>
          <p className="mt-2 text-center text-[9px] text-white/30">Financial information only · Not financial advice · Ollama runs on this device</p>
        </div>
      </footer>
    </div>
  );
}
