"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import type { Investment } from "@/lib/models";
import {
  featuredMarketSymbols,
  normalizeMarketSymbol
} from "@/lib/market-data";
import type { HistoricalReturnScenario, MarketQuote, MarketSearchResult } from "@/lib/market-data";

interface MarketDataResponse {
  quotes?: MarketQuote[];
  errors?: Array<{ symbol: string; message: string }>;
  error?: string;
}

interface MarketSearchResponse {
  results?: MarketSearchResult[];
  error?: string;
}

function formatPrice(quote: MarketQuote) {
  return new Intl.NumberFormat("en-CH", {
    style: "currency",
    currency: quote.currency,
    maximumFractionDigits: quote.assetType === "crypto" ? 6 : 2
  }).format(quote.price);
}

function formatScenario(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function scenarioFor(quote: MarketQuote, observations: 30 | 90): HistoricalReturnScenario | undefined {
  return quote.historicalScenarios.find((scenario) => scenario.horizonObservations === observations);
}

export function MarketWatchlist({ holdings }: { holdings: Investment[] }) {
  const [customSymbols, setCustomSymbols] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MarketSearchResult[]>([]);
  const [quotes, setQuotes] = useState<MarketQuote[]>([]);
  const [errors, setErrors] = useState<Array<{ symbol: string; message: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const symbolKey = useMemo(() => [...new Set([
    ...featuredMarketSymbols.map((item) => item.symbol),
    ...holdings.map((item) => item.ticker),
    ...customSymbols
  ].map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))].join(","), [holdings, customSymbols]);

  const refreshQuotes = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/markets?symbols=${encodeURIComponent(symbolKey)}`, { cache: "no-store" });
      const payload = await response.json() as MarketDataResponse;
      if (!response.ok && !payload.errors?.length) throw new Error(payload.error || "Market data is unavailable.");
      setQuotes(payload.quotes ?? []);
      setErrors(payload.errors ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Market data is unavailable. Try again later.");
    } finally {
      setLoading(false);
    }
  }, [symbolKey]);

  useEffect(() => {
    void refreshQuotes();
  }, [refreshQuotes]);

  async function searchMarkets(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query || query.length > 80) {
      setSearchError("Enter a company, ticker, or crypto name to search.");
      return;
    }
    setSearching(true);
    setSearchError("");
    setSearchResults([]);
    try {
      const response = await fetch(`/api/markets/search?q=${encodeURIComponent(query)}`, { cache: "no-store" });
      const payload = await response.json() as MarketSearchResponse;
      if (!response.ok) throw new Error(payload.error || "Yahoo Finance search is unavailable.");
      setSearchResults(payload.results ?? []);
      if (!payload.results?.length) setSearchError("No matching stock, ETF, or cryptocurrency was found.");
    } catch (reason) {
      setSearchError(reason instanceof Error ? reason.message : "Yahoo Finance search is unavailable.");
    } finally {
      setSearching(false);
    }
  }

  function addSymbol(symbol: string) {
    const normalized = normalizeMarketSymbol(symbol);
    if (!normalized) {
      setSearchError("Yahoo Finance returned an invalid ticker.");
      return;
    }
    setCustomSymbols((current) => [...new Set([...current, normalized])]);
    setSearchResults((current) => current.filter((result) => result.symbol !== normalized));
  }

  return (
    <section className="mt-5 rounded-2xl border border-line bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-ink">Market watchlist and historical scenarios</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">Popular Swiss stocks, major crypto, your holdings, and searchable Yahoo Finance listings.</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50" disabled={loading} onClick={() => void refreshQuotes()} type="button">
          <RefreshCw className={loading ? "animate-spin" : ""} size={14} /> Refresh quotes
        </button>
      </div>

      <form className="mt-4 flex gap-2" onSubmit={searchMarkets}>
        <label className="sr-only" htmlFor="market-symbol">Search Yahoo Finance listings</label>
        <input
          className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand"
          id="market-symbol"
          maxLength={80}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search any stock, crypto, company, or ticker"
          value={searchQuery}
        />
        <button className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50" disabled={searching || !searchQuery.trim()} type="submit"><Search size={14} /> {searching ? "Searching…" : "Search"}</button>
      </form>

      {searchError && <p className="mt-3 text-xs text-amber-700" role="alert">{searchError}</p>}
      {searchResults.length > 0 && <div className="mt-3 max-h-56 overflow-y-auto rounded-xl border border-slate-100">
        {searchResults.map((result) => <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 last:border-b-0" key={result.symbol}>
          <div className="min-w-0"><p className="truncate text-xs font-semibold text-ink">{result.name}</p><p className="text-[10px] text-slate-400">{result.symbol} · {result.exchange} · {result.assetType}</p></div>
          <button className="shrink-0 rounded-md border border-slate-200 px-2.5 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50" onClick={() => addSymbol(result.symbol)} type="button">Add</button>
        </div>)}
      </div>}

      {error && <p className="mt-3 text-xs text-amber-700" role="alert">{error}</p>}
      {errors.length > 0 && <p className="mt-3 text-xs text-amber-700" role="status">{errors.map((item) => `${item.symbol}: ${item.message}`).join(" ")}</p>}

      {quotes.length > 0
        ? <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {quotes.map((quote) => (
              <article className="rounded-xl border border-slate-100 bg-slate-50/60 p-4" key={quote.symbol}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{quote.name}</p>
                    <p className="mt-0.5 text-[10px] font-medium text-slate-400">{quote.symbol} · {quote.assetType === "crypto" ? "Crypto" : quote.assetType === "equity" ? "Equity" : "Market asset"}</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-ink">{formatPrice(quote)}</p>
                </div>
                <p className="mt-2 text-[10px] text-slate-400">Quote time: {new Date(quote.asOf).toLocaleString("en-CH")} · {quote.observations} daily observations</p>
                <div className="mt-3 border-t border-slate-200 pt-2">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Past rolling returns · 5th / median / 95th percentile</p>
                  {[30, 90].map((horizon) => {
                    const scenario = scenarioFor(quote, horizon as 30 | 90);
                    return <p className="flex justify-between gap-2 text-[10px] leading-5 text-slate-600" key={horizon}>
                      <span>{horizon} observations{scenario ? ` · ${scenario.sampleCount} periods` : ""}</span>
                      <span className="font-medium">{scenario ? `${formatScenario(scenario.lowPercent)} / ${formatScenario(scenario.medianPercent)} / ${formatScenario(scenario.highPercent)}` : "Not enough history"}</span>
                    </p>;
                  })}
                </div>
              </article>
            ))}
          </div>
        : <div className="py-8 text-center text-xs text-slate-500">{loading ? "Loading market quotes…" : "Market quotes will appear here when available."}</div>}

      <p className="mt-4 text-[10px] leading-4 text-slate-400">Yahoo Finance search returns matching listings, not a complete list displayed all at once; search by company or ticker to add more. Data is unofficial and may be delayed or unavailable. Scenario ranges describe historical rolling returns, not price predictions or guaranteed profit. Swissquote’s tested public feed returned FX quotes, not the equity or crypto symbols shown here.</p>
    </section>
  );
}
