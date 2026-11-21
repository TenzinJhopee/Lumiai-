import { searchYahooMarkets } from "@/lib/market-data";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!query || query.length > 80) {
    return Response.json({ error: "Search text must contain between 1 and 80 characters." }, { status: 400 });
  }
  try {
    const results = await searchYahooMarkets(query);
    return Response.json({ results }, { headers: { "Cache-Control": "no-store" } });
  } catch (reason) {
    return Response.json({
      error: reason instanceof Error ? reason.message : "Yahoo Finance search is unavailable."
    }, { status: 502 });
  }
}
