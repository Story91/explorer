"use client";

import { useEffect, useState, useCallback } from "react";
import type { AgentReputation } from "@/types/events";
import { generateMockAgents } from "@/lib/mock";

export function usePeers() {
  const strictReal = process.env.NEXT_PUBLIC_STRICT_REAL_DATA === "true";
  const [agents, setAgents] = useState<AgentReputation[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"live" | "mock" | "error">("live");
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/peers");
      if (res.ok) {
        const data: AgentReputation[] = await res.json();
        setAgents(data);
        setMode("live");
      } else {
        const message = `Peers API failed: HTTP ${res.status}`;
        if (strictReal) {
          setMode("error");
          setError(message);
          setAgents([]);
        } else {
          setAgents(generateMockAgents());
          setMode("mock");
          setError(message);
        }
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Peers API request failed";
      if (strictReal) {
        setMode("error");
        setError(message);
        setAgents([]);
      } else {
        setAgents(generateMockAgents());
        setMode("mock");
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [strictReal]);

  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, 60000);
    return () => clearInterval(interval);
  }, [fetchAgents]);

  return { agents, loading, mode, error };
}
