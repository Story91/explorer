"use client";

import { useEffect, useState, useCallback } from "react";
import type { NetworkStats } from "@/types/events";
import { generateMockNetworkStats } from "@/lib/mock";

export function useKPIData(refreshInterval = 30000) {
  const strictReal = process.env.NEXT_PUBLIC_STRICT_REAL_DATA === "true";
  const [data, setData] = useState<NetworkStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"live" | "mock" | "error">("live");
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/activity");
      if (res.ok) {
        const stats: NetworkStats = await res.json();
        setData(stats);
        setMode("live");
      } else {
        const message = `KPI API failed: HTTP ${res.status}`;
        if (strictReal) {
          setMode("error");
          setError(message);
          setData(null);
        } else {
          setData(generateMockNetworkStats());
          setMode("mock");
          setError(message);
        }
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "KPI API request failed";
      if (strictReal) {
        setMode("error");
        setError(message);
        setData(null);
      } else {
        setData(generateMockNetworkStats());
        setMode("mock");
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [strictReal]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchData, refreshInterval]);

  return { data, loading, mode, error };
}
