import { NextRequest, NextResponse } from "next/server";
import { generateMockNetworkStats, generateMockEvent } from "@/lib/mock";

// Without query params: proxies to GET /stats/network → NetworkStats
// With ?events=true: proxies to GET /activity?limit=N → ActivityEvent[]
export async function GET(request: NextRequest) {
  const strictReal = process.env.STRICT_REAL_DATA === "true";
  const wantEvents = request.nextUrl.searchParams.get("events") === "true";
  const limit = request.nextUrl.searchParams.get("limit") || "50";

  if (!strictReal && process.env.USE_MOCK_DATA === "true") {
    if (wantEvents) {
      const events = Array.from({ length: Number(limit) }, () =>
        generateMockEvent()
      );
      return NextResponse.json(events);
    }
    return NextResponse.json(generateMockNetworkStats());
  }

  try {
    const endpoint = wantEvents
      ? `${process.env.AGGREGATOR_URL}/activity?limit=${limit}`
      : `${process.env.AGGREGATOR_URL}/stats/network`;

    const headers: Record<string, string> = {};
    if (process.env.AGGREGATOR_API_TOKEN) {
      headers["Authorization"] = `Bearer ${process.env.AGGREGATOR_API_TOKEN}`;
    }
    const res = await fetch(endpoint, {
      next: { revalidate: wantEvents ? 5 : 30 },
      headers,
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Upstream error" },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    if (strictReal) {
      return NextResponse.json(
        { error: "Upstream unavailable" },
        { status: 502 }
      );
    }
    if (wantEvents) {
      const events = Array.from({ length: Number(limit) }, () =>
        generateMockEvent()
      );
      return NextResponse.json(events);
    }
    return NextResponse.json(generateMockNetworkStats());
  }
}
