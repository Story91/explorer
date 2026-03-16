import { NextResponse } from "next/server";
import { generateMockAgents } from "@/lib/mock";

// Proxies to aggregator GET /agents?sort=recent&limit=200
// Returns AgentReputation[] — the globe uses country/city for coordinates
export async function GET() {
  const strictReal = process.env.STRICT_REAL_DATA === "true";

  if (!strictReal && process.env.USE_MOCK_DATA === "true") {
    return NextResponse.json(generateMockAgents());
  }

  try {
    const headers: Record<string, string> = {};
    if (process.env.AGGREGATOR_API_TOKEN) {
      headers["Authorization"] = `Bearer ${process.env.AGGREGATOR_API_TOKEN}`;
    }
    const res = await fetch(
      `${process.env.AGGREGATOR_URL}/agents?sort=recent&limit=200`,
      { next: { revalidate: 30 }, headers }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: "Upstream error" },
        { status: res.status }
      );
    }

    const data = await res.json();
    const agents = Array.isArray(data) ? data : data.value ?? [];
    return NextResponse.json(agents);
  } catch {
    if (strictReal) {
      return NextResponse.json(
        { error: "Upstream unavailable" },
        { status: 502 }
      );
    }
    return NextResponse.json(generateMockAgents());
  }
}
