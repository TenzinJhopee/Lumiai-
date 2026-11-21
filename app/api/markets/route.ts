import { fetchYahooQuote, featuredMarketSymbols, normalizeMarketSymbol } from "@/lib/market-data";

export const runtime = "nodejs";

const MAX_MARKET_SYMBOLS = 25;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedSymbols = url.searchParams.has("symbols")
    ? (url.searchParams.get("symbols") ?? "").split(",")
    : featuredMarketSymbols.map((item) => item.symbol);
  const normalizedSymbols = requestedSymbols.map(normalizeMarketSymbol);
  if (!normalizedSymbols.length || normalizedSymbols.some((symbol) => symbol === null)) {
    return Response.json({ error: "Provide valid ticker symbols separated by commas." }, { status: 400 });
  }
  const symbols = [...new Set(normalizedSymbols.filter((symbol): symbol is string => symbol !== null))];
  if (symbols.length > MAX_MARKET_SYMBOLS) {
    return Response.json({ error: `Request no more than ${MAX_MARKET_SYMBOLS} market symbols at once.` }, { status: 400 });
  }

  const results = await Promise.all(symbols.map(async (symbol) => {
    try {
      return { quote: await fetchYahooQuote(symbol) };
    } catch (reason) {
      return {
        error: {
          symbol,
          message: reason instanceof Error ? reason.message : `Could not load ${symbol}.`
        }
      };
    }
  }));
  const quotes = results.flatMap((result) => "quote" in result ? [result.quote] : []);
  const errors = results.flatMap((result) => "error" in result ? [result.error] : []);
  const headers = { "Cache-Control": "no-store" };
  if (!quotes.length) {
    return Response.json({ error: "No market quotes could be retrieved.", quotes, errors }, { status: 502, headers });
  }
  return Response.json({ quotes, errors }, { headers });
}
