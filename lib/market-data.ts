import { z } from "zod";

export const featuredMarketSymbols = [
  { symbol: "NESN.SW", name: "Nestle", group: "Swiss stocks" },
  { symbol: "NOVN.SW", name: "Novartis", group: "Swiss stocks" },
  { symbol: "UBSG.SW", name: "UBS", group: "Swiss stocks" },
  { symbol: "ABBN.SW", name: "ABB", group: "Swiss stocks" },
  { symbol: "ZURN.SW", name: "Zurich Insurance", group: "Swiss stocks" },
  { symbol: "CFR.SW", name: "Richemont", group: "Swiss stocks" },
  { symbol: "BTC-USD", name: "Bitcoin", group: "Crypto" },
  { symbol: "ETH-USD", name: "Ethereum", group: "Crypto" },
  { symbol: "SOL-USD", name: "Solana", group: "Crypto" },
  { symbol: "XRP-USD", name: "XRP", group: "Crypto" },
  { symbol: "BNB-USD", name: "BNB", group: "Crypto" }
] as const;

const symbolPattern = /^[A-Z0-9.^=-]{1,24}$/;

export function normalizeMarketSymbol(value: string) {
  const symbol = value.trim().toUpperCase();
  return symbolPattern.test(symbol) ? symbol : null;
}

export interface HistoricalReturnScenario {
  horizonObservations: 30 | 90;
  sampleCount: number;
  lowPercent: number;
  medianPercent: number;
  highPercent: number;
}

export interface MarketQuote {
  symbol: string;
  name: string;
  currency: string;
  assetType: "equity" | "crypto" | "other";
  price: number;
  asOf: string;
  observations: number;
  historicalScenarios: HistoricalReturnScenario[];
}

export interface MarketSearchResult {
  symbol: string;
  name: string;
  exchange: string;
  assetType: "equity" | "crypto" | "etf";
}

interface HistoryPoint {
  date: string;
  close: number;
}

const yahooResultSchema = z.object({
  meta: z.object({
    symbol: z.string().optional(),
    currency: z.string().optional(),
    instrumentType: z.string().optional(),
    shortName: z.string().nullable().optional(),
    longName: z.string().nullable().optional(),
    regularMarketPrice: z.number().finite().nullable().optional(),
    regularMarketTime: z.number().finite().nullable().optional()
  }).passthrough(),
  timestamp: z.array(z.number().finite()).optional(),
  indicators: z.object({
    quote: z.array(z.object({
      close: z.array(z.number().finite().nullable()).optional()
    }).passthrough()).optional()
  }).passthrough()
}).passthrough();

const yahooResponseSchema = z.object({
  chart: z.object({
    result: z.array(yahooResultSchema).nullable().optional(),
    error: z.unknown().optional()
  }).passthrough()
}).passthrough();

const yahooSearchResponseSchema = z.object({
  quotes: z.array(z.object({
    symbol: z.string(),
    quoteType: z.string().optional(),
    shortname: z.string().nullable().optional(),
    longname: z.string().nullable().optional(),
    exchange: z.string().optional()
  }).passthrough()).optional()
}).passthrough();

function percentile(sortedValues: number[], fraction: number) {
  const position = (sortedValues.length - 1) * fraction;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  if (lowerIndex === upperIndex) return sortedValues[lowerIndex];
  const weight = position - lowerIndex;
  return sortedValues[lowerIndex] * (1 - weight) + sortedValues[upperIndex] * weight;
}

export function calculateHistoricalReturnScenarios(history: HistoryPoint[]): HistoricalReturnScenario[] {
  const scenarios: HistoricalReturnScenario[] = [];
  for (const horizonObservations of [30, 90] as const) {
    const returns: number[] = [];
    for (let start = 0; start + horizonObservations < history.length; start += 1) {
      const startClose = history[start].close;
      const endClose = history[start + horizonObservations].close;
      if (startClose > 0 && endClose > 0) returns.push((endClose / startClose - 1) * 100);
    }
    if (returns.length < 10) continue;
    returns.sort((a, b) => a - b);
    scenarios.push({
      horizonObservations,
      sampleCount: returns.length,
      lowPercent: percentile(returns, 0.05),
      medianPercent: percentile(returns, 0.5),
      highPercent: percentile(returns, 0.95)
    });
  }
  return scenarios;
}

export async function fetchYahooQuote(symbol: string, fetcher: typeof fetch = fetch): Promise<MarketQuote> {
  const normalizedSymbol = normalizeMarketSymbol(symbol);
  if (!normalizedSymbol) throw new Error("Use a valid Yahoo Finance ticker symbol.");

  const endpoint = new URL(`/v8/finance/chart/${encodeURIComponent(normalizedSymbol)}`, "https://query1.finance.yahoo.com");
  endpoint.searchParams.set("range", "1y");
  endpoint.searchParams.set("interval", "1d");
  const response = await fetcher(endpoint, {
    headers: { "User-Agent": "Mozilla/5.0 LumaFinancialAgent/1.0" },
    signal: AbortSignal.timeout(12_000)
  });
  if (!response.ok) throw new Error(`Yahoo Finance returned HTTP ${response.status} for ${normalizedSymbol}.`);

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Yahoo Finance returned invalid data for ${normalizedSymbol}.`);
  }
  const parsed = yahooResponseSchema.safeParse(payload);
  if (!parsed.success) throw new Error(`Yahoo Finance returned an unsupported quote format for ${normalizedSymbol}.`);
  const result = parsed.data.chart.result?.[0];
  if (!result) throw new Error(`Yahoo Finance has no quote history for ${normalizedSymbol}.`);

  const currency = result.meta.currency;
  if (!currency || !/^[A-Z]{3}$/.test(currency)) throw new Error(`Yahoo Finance did not provide a currency for ${normalizedSymbol}.`);
  const timestamps = result.timestamp ?? [];
  const closes = result.indicators.quote?.[0]?.close ?? [];
  const history = timestamps.flatMap((timestamp, index) => {
    const close = closes[index];
    if (typeof close !== "number" || !Number.isFinite(close) || close <= 0) return [];
    return [{ date: new Date(timestamp * 1000).toISOString().slice(0, 10), close }];
  });
  const lastHistoryPoint = history.at(-1);
  const price = result.meta.regularMarketPrice ?? lastHistoryPoint?.close;
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
    throw new Error(`Yahoo Finance did not provide a current price for ${normalizedSymbol}.`);
  }

  const marketTime = result.meta.regularMarketTime;
  const asOf = typeof marketTime === "number"
    ? new Date(marketTime * 1000).toISOString()
    : lastHistoryPoint ? `${lastHistoryPoint.date}T00:00:00.000Z` : "";
  if (!asOf) throw new Error(`Yahoo Finance did not provide a quote time for ${normalizedSymbol}.`);

  return {
    symbol: result.meta.symbol || normalizedSymbol,
    name: result.meta.longName || result.meta.shortName || normalizedSymbol,
    currency,
    assetType: result.meta.instrumentType === "CRYPTOCURRENCY"
      ? "crypto"
      : result.meta.instrumentType === "EQUITY" ? "equity" : "other",
    price,
    asOf,
    observations: history.length,
    historicalScenarios: calculateHistoricalReturnScenarios(history)
  };
}

export async function searchYahooMarkets(query: string, fetcher: typeof fetch = fetch): Promise<MarketSearchResult[]> {
  const searchTerm = query.trim();
  if (!searchTerm || searchTerm.length > 80) throw new Error("Search text must contain between 1 and 80 characters.");

  const endpoint = new URL("/v1/finance/search", "https://query1.finance.yahoo.com");
  endpoint.searchParams.set("q", searchTerm);
  endpoint.searchParams.set("quotesCount", "25");
  endpoint.searchParams.set("newsCount", "0");
  endpoint.searchParams.set("enableFuzzyQuery", "true");
  const response = await fetcher(endpoint, {
    headers: { "User-Agent": "Mozilla/5.0 LumaFinancialAgent/1.0" },
    signal: AbortSignal.timeout(12_000)
  });
  if (!response.ok) throw new Error(`Yahoo Finance search returned HTTP ${response.status}.`);

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("Yahoo Finance returned invalid search data.");
  }
  const parsed = yahooSearchResponseSchema.safeParse(payload);
  if (!parsed.success) throw new Error("Yahoo Finance returned an unsupported search format.");

  const results: MarketSearchResult[] = [];
  const seenSymbols = new Set<string>();
  for (const result of parsed.data.quotes ?? []) {
    const symbol = normalizeMarketSymbol(result.symbol);
    if (!symbol || seenSymbols.has(symbol)) continue;
    const assetType = result.quoteType === "CRYPTOCURRENCY"
      ? "crypto"
      : result.quoteType === "EQUITY" ? "equity" : result.quoteType === "ETF" ? "etf" : null;
    if (!assetType) continue;
    seenSymbols.add(symbol);
    results.push({
      symbol,
      name: result.longname || result.shortname || symbol,
      exchange: result.exchange || "Yahoo Finance",
      assetType
    });
  }
  return results;
}
