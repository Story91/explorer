import { NextRequest, NextResponse } from "next/server";
import { generateMockAgents } from "@/lib/mock";

// Proxies to aggregator GET /leaderboard?limit=N → AgentReputation[] sorted by average_score
export async function GET(request: NextRequest) {
  const strictReal = process.env.STRICT_REAL_DATA === "true";
  const limit = request.nextUrl.searchParams.get("limit") || "20";

  if (!strictReal && process.env.USE_MOCK_DATA === "true") {
    const agents = generateMockAgents()
      .sort((a, b) => b.average_score - a.average_score)
      .slice(0, Number(limit));
    return NextResponse.json(agents);
  }

  try {
    const res = await fetch(
      `${process.env.AGGREGATOR_URL}/leaderboard?limit=${limit}`,
      { next: { revalidate: 30 } }
    );

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
    const agents = generateMockAgents()
      .sort((a, b) => b.average_score - a.average_score)
      .slice(0, Number(limit));
    return NextResponse.json(agents);
  }
}
