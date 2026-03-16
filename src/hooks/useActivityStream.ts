"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { ActivityEvent } from "@/types/events";
import { generateMockEvent } from "@/lib/mock";

const MAX_EVENTS = 100;
const WS_FALLBACK_TIMEOUT = 8000;
const POLL_INTERVAL_MS = 10000;

export function useActivityStream() {
  const strictReal = process.env.NEXT_PUBLIC_STRICT_REAL_DATA === "true";
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
  const missingWsInStrictMode = strictReal && !wsUrl;
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [mode, setMode] = useState<"live" | "mock" | "error">(
    missingWsInStrictMode ? "error" : "live"
  );
  const [error, setError] = useState<string | null>(
    missingWsInStrictMode ? "NEXT_PUBLIC_WS_URL is missing in strict real-data mode" : null
  );
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mockTimer = useRef<ReturnType<typeof setInterval>>(undefined);
  const pollTimer = useRef<ReturnType<typeof setInterval>>(undefined);
  const pollingActive = useRef(false);
  const backoff = useRef(1000);

  const addEvent = useCallback((event: ActivityEvent) => {
    setEvents((prev) => [event, ...prev].slice(0, MAX_EVENTS));
  }, []);

  const startMock = useCallback(() => {
    setConnected(true);
    setIsLive(false);
    setMode("mock");
    setError("Using mock stream fallback");
    for (let i = 0; i < 8; i++) {
      const e = generateMockEvent();
      e.ts = Math.floor(Date.now() / 1000) - (8 - i) * 3;
      addEvent(e);
    }
    mockTimer.current = setInterval(() => {
      addEvent(generateMockEvent());
    }, 2000 + Math.random() * 3000);
  }, [addEvent]);

  const stopRealPolling = useCallback(() => {
    pollingActive.current = false;
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = undefined;
    }
  }, []);

  const fetchRealEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/activity?events=true&limit=50", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Invalid events payload");
      setEvents(data.slice(0, MAX_EVENTS));
      setConnected(true);
      setIsLive(true);
      setMode("live");
      setError(null);
      return true;
    } catch (e: unknown) {
      if (strictReal) {
        const message =
          e instanceof Error ? e.message : "Failed to fetch activity events";
        setConnected(false);
        setIsLive(false);
        setMode("error");
        setError(`HTTP polling failed: ${message}`);
      }
      return false;
    }
  }, [strictReal]);

  const startRealPolling = useCallback(() => {
    if (pollingActive.current) return;
    pollingActive.current = true;
    void fetchRealEvents();
    pollTimer.current = setInterval(() => {
      void fetchRealEvents();
    }, POLL_INTERVAL_MS);
  }, [fetchRealEvents]);

  useEffect(() => {
    const wsUrlValue = wsUrl;

    if (!wsUrlValue) {
      if (strictReal) {
        startRealPolling();
        return () => {
          stopRealPolling();
        };
      }
      startMock();
      return () => {
        if (mockTimer.current) clearInterval(mockTimer.current);
      };
    }

    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
    let fallen = false;

    function connect(url: string) {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      fallbackTimer = setTimeout(() => {
        if (!fallen && ws.readyState !== WebSocket.OPEN) {
          fallen = true;
          ws.close();
          if (strictReal) {
            setConnected(false);
            setIsLive(false);
            setError("WebSocket timeout, switching to HTTP polling");
            startRealPolling();
          } else {
            startMock();
          }
        }
      }, WS_FALLBACK_TIMEOUT);

      ws.onopen = () => {
        if (fallbackTimer) clearTimeout(fallbackTimer);
        stopRealPolling();
        setConnected(true);
        setIsLive(true);
        setMode("live");
        setError(null);
        backoff.current = 1000;
      };

      ws.onmessage = (e) => {
        try {
          const event: ActivityEvent = JSON.parse(e.data);
          addEvent(event);
        } catch {
          // skip malformed
        }
      };

      ws.onclose = () => {
        setConnected(false);
        setIsLive(false);
        if (strictReal) {
          setError("WebSocket disconnected, using HTTP polling");
          startRealPolling();
        }
        if (!fallen) {
          reconnectTimer.current = setTimeout(() => {
            backoff.current = Math.min(backoff.current * 2, 30000);
            connect(url);
          }, backoff.current);
        }
      };

      ws.onerror = () => {
        if (strictReal) {
          setError("WebSocket error, switching to HTTP polling");
          startRealPolling();
        }
        ws.close();
      };
    }

    connect(wsUrlValue);

    return () => {
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (mockTimer.current) clearInterval(mockTimer.current);
      stopRealPolling();
      wsRef.current?.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [startMock, strictReal, startRealPolling, stopRealPolling, wsUrl]);

  return { events, connected, isLive, mode, error };
}
