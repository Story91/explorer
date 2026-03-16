import { NextRequest, NextResponse } from "next/server";

// Proxies to aggregator GET /agents/{agent_id}/profile → AgentProfile
// Falls back to GET /reputation/{agent_id} → AgentReputation
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const strictReal = process.env.STRICT_REAL_DATA === "true";
  const { agentId } = await params;

  if (!strictReal && process.env.USE_MOCK_DATA === "true") {
    return NextResponse.json({
      agent_id: agentId,
      name: "mock-agent",
      reputation: {
        agent_id: agentId,
        feedback_count: 20 + Math.floor(Math.random() * 60),
        total_score: 50 + Math.floor(Math.random() * 100),
        positive_count: 15 + Math.floor(Math.random() * 40),
        neutral_count: 2 + Math.floor(Math.random() * 10),
        negative_count: Math.floor(Math.random() * 5),
        verdict_count: Math.floor(Math.random() * 3),
        average_score: 2.5 + Math.random() * 2.5,
        last_updated: Date.now(),
        trend: (["rising", "stable", "falling"] as const)[
          Math.floor(Math.random() * 3)
        ],
        last_seen: Date.now() - Math.floor(Math.random() * 3600000),
        name: "mock-agent",
        country: "US",
        city: "New York",
        latency: { "us-east": 45 },
        geo_consistent: true,
      },
      entropy: {
        agent_id: agentId,
        epoch: 100,
        ht: 0.3 + Math.random() * 0.5,
        hb: 0.3 + Math.random() * 0.5,
        hs: 0.3 + Math.random() * 0.5,
        hv: 0.3 + Math.random() * 0.5,
        anomaly: Math.random() * 0.3,
        n_ht: 10,
        n_hb: 10,
        n_hs: 10,
        n_hv: 10,
      },
      capabilities: [
        {
          agent_id: agentId,
          capability: "coding",
          last_seen: Date.now(),
        },
        {
          agent_id: agentId,
          capability: "translation",
          last_seen: Date.now(),
        },
      ],
      disputes: [],
      last_seen: Date.now(),
    });
  }

  try {
    const headers: Record<string, string> = {};
    if (process.env.AGGREGATOR_API_TOKEN) {
      headers["Authorization"] = `Bearer ${process.env.AGGREGATOR_API_TOKEN}`;
    }
    const res = await fetch(
      `${process.env.AGGREGATOR_URL}/agents/${agentId}/profile`,
      { headers }
    );

    if (!res.ok) {
      const repRes = await fetch(
        `${process.env.AGGREGATOR_URL}/reputation/${agentId}`,
        { headers }
      );
      if (!repRes.ok) {
        return NextResponse.json(
          { error: "Agent not found" },
          { status: 404 }
        );
      }
      const rep = await repRes.json();
      return NextResponse.json({
        agent_id: agentId,
        reputation: rep,
        capabilities: [],
        disputes: [],
      });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch agent profile" },
      { status: 500 }
    );
  }
}
