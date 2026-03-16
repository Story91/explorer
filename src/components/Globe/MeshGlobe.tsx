"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { GlobeMethods } from "react-globe.gl";
import type { AgentReputation, ActivityEvent, PointData } from "@/types/events";
import {
  resolveGeo,
  geoFromId,
  nearestBootstrap,
  BOOTSTRAP_NODES,
} from "@/lib/geo";

const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

interface MeshGlobeProps {
  agents: AgentReputation[];
  events: ActivityEvent[];
  beaconBpm?: number;
  onAgentClick?: (agent: AgentReputation) => void;
}

interface RingData {
  lat: number;
  lng: number;
  maxR: number;
  propagationSpeed: number;
  repeatPeriod: number;
}

interface LiveArc {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: [string, string];
  stroke: number;
  id: number;
}

const EVENT_COLORS: Record<string, [string, string]> = {
  FEEDBACK: ["#ffb800cc", "#00ff88aa"],
  DISPUTE: ["#ff4466cc", "#ff4466aa"],
  VERDICT: ["#a855f7cc", "#00f0ffaa"],
  JOIN: ["#00f0ffcc", "#00ff88aa"],
};

const LIVE_ARC_STROKE = 0.55;
const DISPUTE_ARC_STROKE = 0.75;
const STATIC_ARC_STROKE = 0.2;

export function MeshGlobe({ agents, events, beaconBpm = 0, onAgentClick }: MeshGlobeProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [liveArcs, setLiveArcs] = useState<LiveArc[]>([]);
  const arcIdRef = useRef(0);
  const lastEventIdRef = useRef<number | null>(null);

  useEffect(() => {
    function handleResize() {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const globe = globeRef.current;
    if (globe && typeof globe.controls === "function") {
      const controls = globe.controls();
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.4;
      controls.enableZoom = true;
    }
  }, []);

  // Resolve agent_id to globe coordinates (only for agents currently rendered).
  const agentGeoMap = useMemo(() => {
    const map = new Map<string, { lat: number; lng: number }>();
    for (const a of agents) {
      map.set(a.agent_id, resolveGeo(a.country, a.city) ?? geoFromId(a.agent_id));
    }
    return map;
  }, [agents]);

  // Bootstrap lookup used for JOIN/untargeted events.
  const bootstrapGeoMap = useMemo(() => {
    const map = new Map<string, { lat: number; lng: number }>();
    for (const n of BOOTSTRAP_NODES) {
      map.set(`bootstrap-${n.label}`, { lat: n.lat, lng: n.lng });
    }
    return map;
  }, []);

  // Convert real-time events into arcs on the globe
  useEffect(() => {
    if (events.length === 0) return;

    // Collect events we haven't seen yet (events[0] is newest)
    const unseen: ActivityEvent[] = [];
    for (const ev of events) {
      if (ev.id === lastEventIdRef.current) break;
      unseen.push(ev);
    }
    if (unseen.length === 0) return;
    lastEventIdRef.current = events[0].id;

    const newArcs: LiveArc[] = [];
    for (const ev of unseen) {
      // Draw arcs only from visible/rendered agents to keep line origins exact.
      const from = agentGeoMap.get(ev.agent_id);
      if (!from) continue;
      let to: { lat: number; lng: number };

      if (ev.target_id) {
        // If target agent is not visible on current map data, skip the arc.
        const target = agentGeoMap.get(ev.target_id);
        if (!target) continue;
        to = target;
      } else {
        const nearest = nearestBootstrap(from.lat, from.lng);
        const bootstrapKey = `bootstrap-${nearest.label}`;
        to = bootstrapGeoMap.get(bootstrapKey) ?? nearest;
      }

      if (Math.abs(from.lat - to.lat) < 0.5 && Math.abs(from.lng - to.lng) < 0.5) continue;

      newArcs.push({
        startLat: from.lat,
        startLng: from.lng,
        endLat: to.lat,
        endLng: to.lng,
        color: EVENT_COLORS[ev.event_type] ?? EVENT_COLORS.JOIN,
        stroke: ev.event_type === "DISPUTE" ? DISPUTE_ARC_STROKE : LIVE_ARC_STROKE,
        id: arcIdRef.current++,
      });
    }

    if (newArcs.length === 0) return;

    setLiveArcs((prev) => [...newArcs, ...prev].slice(0, 12));
  }, [events, agentGeoMap, bootstrapGeoMap]);

  // Fade out old arcs
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveArcs((prev) => {
        if (prev.length <= 3) return prev;
        return prev.slice(0, -1);
      });
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const points: PointData[] = useMemo(() => {
    const agentPoints: PointData[] = [];
    for (const a of agents) {
      const geo = agentGeoMap.get(a.agent_id) ?? geoFromId(a.agent_id);
      const isActive = Date.now() / 1000 - a.last_seen < 300;
      const hasRealGeo = !!(a.country || a.city);

      agentPoints.push({
        lat: geo.lat,
        lng: geo.lng,
        size: isActive ? 0.6 : hasRealGeo ? 0.3 : 0.25,
        color: isActive ? "#00f0ff" : hasRealGeo ? "#00f0ff44" : "#8b0000",
        agent_id: a.agent_id,
        label: a.city || a.country,
        name: a.name,
        country: a.country,
        city: a.city,
      });
    }

    const bootstrapPoints: PointData[] = BOOTSTRAP_NODES.map((n) => ({
      lat: n.lat,
      lng: n.lng,
      size: 0.9,
      color: "#00ff88",
      agent_id: `bootstrap-${n.label}`,
      label: n.label,
      name: n.label,
    }));

    return [...agentPoints, ...bootstrapPoints];
  }, [agents, agentGeoMap]);

  // Static arcs: active agents → nearest bootstrap
  const staticArcs = useMemo(() => {
    return agents
      .filter((a) => {
        const geo = agentGeoMap.get(a.agent_id);
        return geo && Date.now() / 1000 - a.last_seen < 300;
      })
      .map((a) => {
        const geo = agentGeoMap.get(a.agent_id)!;
        const bootstrap = nearestBootstrap(geo.lat, geo.lng);
        return {
          startLat: geo.lat,
          startLng: geo.lng,
          endLat: bootstrap.lat,
          endLng: bootstrap.lng,
          color: ["#00f0ff33", "#00ff8822"] as [string, string],
          stroke: STATIC_ARC_STROKE,
          id: -1,
        };
      });
  }, [agents, agentGeoMap]);

  const allArcs = useMemo(() => [...liveArcs, ...staticArcs], [liveArcs, staticArcs]);

  // Pulsing rings on bootstrap nodes
  const rings: RingData[] = useMemo(() => {
    if (beaconBpm <= 0) return [];
    const period = Math.max(800, 60000 / beaconBpm);
    return BOOTSTRAP_NODES.map((n) => ({
      lat: n.lat,
      lng: n.lng,
      maxR: 5,
      propagationSpeed: 3,
      repeatPeriod: period,
    }));
  }, [beaconBpm]);

  const handlePointClick = useCallback(
    (point: object) => {
      const p = point as PointData;
      if (p.agent_id.startsWith("bootstrap-")) return;
      const agent = agents.find((a) => a.agent_id === p.agent_id);
      if (agent && onAgentClick) onAgentClick(agent);
    },
    [agents, onAgentClick]
  );

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/80 pointer-events-none z-10" />
      <Globe
        ref={globeRef}
        width={dimensions.width}
        height={dimensions.height}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        backgroundColor="rgba(0,0,0,0)"
        atmosphereColor="#00f0ff"
        atmosphereAltitude={0.2}
        pointsData={points}
        pointLat="lat"
        pointLng="lng"
        pointRadius="size"
        pointColor="color"
        pointAltitude={0}
        pointsMerge={false}
        onPointClick={handlePointClick}
        arcsData={allArcs}
        arcStartLat="startLat"
        arcStartLng="startLng"
        arcEndLat="endLat"
        arcEndLng="endLng"
        arcColor="color"
        arcDashLength={0.6}
        arcDashGap={0.3}
        arcDashAnimateTime={1200}
        arcStroke={(d: object) => (d as LiveArc).stroke ?? 0.5}
        arcAltitudeAutoScale={0.34}
        ringsData={rings}
        ringLat="lat"
        ringLng="lng"
        ringMaxRadius="maxR"
        ringPropagationSpeed="propagationSpeed"
        ringRepeatPeriod="repeatPeriod"
        ringColor={() => (t: number) => `rgba(0,240,255,${(1 - t) * 0.6})`}
        animateIn={true}
      />
    </div>
  );
}
