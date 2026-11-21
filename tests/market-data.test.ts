import assert from "node:assert/strict";
import test from "node:test";
import { calculateHistoricalReturnScenarios, fetchYahooQuote, normalizeMarketSymbol, searchYahooMarkets } from "../lib/market-data";

test("market ticker normalization rejects invalid URL input", () => {
  assert.equal(normalizeMarketSymbol(" nesn.sw "), "NESN.SW");
  assert.equal(normalizeMarketSymbol("BTC-USD"), "BTC-USD");
  assert.equal(normalizeMarketSymbol("https://example.com"), null);
});

test("Yahoo quote parsing returns currency and historical rolling scenarios", async () => {
  let requestedUrl = "";
  const quote = await fetchYahooQuote("NESN.SW", async (input) => {
    requestedUrl = String(input);
    return Response.json({
      chart: {
        result: [{
          meta: {
            symbol: "NESN.SW",
            currency: "CHF",
            instrumentType: "EQUITY",
            longName: "Nestle SA",
            regularMarketPrice: 100,
            regularMarketTime: 1_700_000_000
          },
          timestamp: Array.from({ length: 121 }, (_, index) => 1_700_000_000 + index * 86_400),
          indicators: {
            quote: [{ close: Array.from({ length: 121 }, (_, index) => 80 + index) }]
          }
        }]
      }
    });
  });

  assert.match(requestedUrl, /query1\.finance\.yahoo\.com\/v8\/finance\/chart\/NESN\.SW\?range=1y&interval=1d$/);
  assert.equal(quote.currency, "CHF");
  assert.equal(quote.assetType, "equity");
  assert.equal(quote.price, 100);
  assert.equal(quote.observations, 121);
  assert.equal(quote.historicalScenarios[0].horizonObservations, 30);
  assert.equal(quote.historicalScenarios[0].sampleCount, 91);
  assert.equal(quote.historicalScenarios[1].horizonObservations, 90);
  assert.ok(quote.historicalScenarios[0].lowPercent < quote.historicalScenarios[0].highPercent);
});

test("historical scenarios require enough rolling observations", () => {
  const shortHistory = Array.from({ length: 35 }, (_, index) => ({
    date: `2026-01-${String(index + 1).padStart(2, "0")}`,
    close: 100 + index
  }));
  assert.deepEqual(calculateHistoricalReturnScenarios(shortHistory), []);
});

test("Yahoo Finance search finds stocks and crypto while filtering unsupported instruments", async () => {
  let requestedUrl = "";
  const results = await searchYahooMarkets("bitcoin", async (input) => {
    requestedUrl = String(input);
    return Response.json({
      quotes: [
        { symbol: "BTC-USD", shortname: "Bitcoin USD", quoteType: "CRYPTOCURRENCY", exchange: "CCC" },
        { symbol: "IBIT", shortname: "Bitcoin ETF", quoteType: "ETF", exchange: "NGM" },
        { symbol: "BTC=F", shortname: "Bitcoin Future", quoteType: "FUTURE", exchange: "CME" }
      ]
    });
  });

  assert.match(requestedUrl, /query1\.finance\.yahoo\.com\/v1\/finance\/search\?q=bitcoin/);
  assert.deepEqual(results.map((result) => [result.symbol, result.assetType]), [
    ["BTC-USD", "crypto"],
    ["IBIT", "etf"]
  ]);
});
