"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/Layout/Header";
import { MeshGlobe } from "@/components/Globe/MeshGlobe";
import { GlobeOverlay } from "@/components/Globe/GlobeOverlay";
import { EventTicker } from "@/components/Ticker/EventTicker";
import { AgentPreview } from "@/components/Agent/AgentPreview";
import { CTABanner } from "@/components/Layout/CTABanner";
import { useActivityStream } from "@/hooks/useActivityStream";
import { useKPIData } from "@/hooks/useKPIData";
import { usePeers } from "@/hooks/usePeers";
import { BOOTSTRAP_NODES } from "@/lib/geo";
import type { AgentReputation } from "@/types/events";

export default function Explorer() {
  const activity = useActivityStream();
  const kpi = useKPIData();
  const peers = usePeers();
  const { events, connected, isLive } = activity;
  const { data: networkStats } = kpi;
  const { agents } = peers;
  const [selectedAgent, setSelectedAgent] = useState<AgentReputation | null>(
    null
  );

  const dataMode = useMemo<"live" | "mock" | "error">(() => {
    const modes = [activity.mode, kpi.mode, peers.mode];
    if (modes.includes("error")) return "error";
    if (modes.includes("mock")) return "mock";
    return "live";
  }, [activity.mode, kpi.mode, peers.mode]);

  const dataErrors = useMemo(
    () => [activity.error, kpi.error, peers.error].filter(Boolean) as string[],
    [activity.error, kpi.error, peers.error]
  );

  const activeAgentCount = useMemo(() => {
    const fiveMinAgo = Date.now() / 1000 - 300;
    return agents.filter((a) => a.last_seen > fiveMinAgo).length;
  }, [agents]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header connected={connected} dataMode={dataMode} />

      <main className="flex-1 pt-14">
        {dataMode === "error" && (
          <section className="mx-auto max-w-[1920px] px-4 pt-4 lg:px-8">
            <div className="glass border border-neon-red/25 px-4 py-3 text-xs text-neon-red">
              Real data mode is active, but one or more data sources failed.
              {dataErrors.length > 0 ? ` ${dataErrors[0]}` : ""}
            </div>
          </section>
        )}
        {/* Globe + Ticker — full height */}
        <section className="mx-auto max-w-[1920px] px-4 pt-4 lg:px-8">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_420px]">
            {/* Globe */}
            <div
              id="globe"
              className="glass-elevated relative overflow-hidden"
              style={{ minHeight: "clamp(500px, 75vh, 900px)" }}
            >
              <MeshGlobe
                agents={agents}
                events={isLive ? events : []}
                beaconBpm={networkStats?.beacon_bpm ?? 0}
                onAgentClick={(agent) => setSelectedAgent(agent)}
              />
              <GlobeOverlay
                activeCount={activeAgentCount}
                stats={networkStats}
                bootstrapCount={BOOTSTRAP_NODES.length}
              />
              <div className="absolute bottom-4 right-4 z-20">
                <div className="glass px-3 py-2 text-[10px] text-white/40 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-neon-cyan shadow-[0_0_6px_#00f0ff]" />
                    Active Agent
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#8b0000]" />
                    Inactive Agent
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-neon-green shadow-[0_0_6px_#00ff88]" />
                    Bootstrap Node
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-6 border-t-2 border-[#ffb800] rounded-sm" />
                    Live Interaction
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-6 border-t-2 border-dashed border-neon-cyan/30" />
                    Static Link
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-6 border-t-2 border-[#ff4466]" />
                    Dispute
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full border border-neon-cyan/40 bg-transparent animate-ping" style={{ animationDuration: "2s" }} />
                    Pulse Ring
                  </div>
                </div>
              </div>
            </div>

            {/* Ticker */}
            <div className="lg:max-h-[clamp(500px,75vh,900px)]">
              <EventTicker events={events} connected={connected} />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-[1920px] px-4 py-8 lg:px-8">
          <CTABanner />
        </section>

        {/* Footer */}
        <footer className="border-t border-white/5 py-6">
          <div className="mx-auto max-w-[1920px] px-4 lg:px-8 flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
            <p className="text-xs text-white/25">
              &copy; {new Date().getFullYear()} 0x01 Network. All rights
              reserved.
            </p>
            <div className="flex items-center gap-4">
              <a
                href="https://0x01.world"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-white/25 hover:text-white/50 transition-colors"
              >
                Website
              </a>
              <a
                href="https://docs.0x01.world"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-white/25 hover:text-white/50 transition-colors"
              >
                Docs
              </a>
              <a
                href="https://github.com/0x01-a2a"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-white/25 hover:text-white/50 transition-colors"
              >
                GitHub
              </a>
            </div>
          </div>
        </footer>
      </main>

      <AgentPreview
        agent={selectedAgent}
        onClose={() => setSelectedAgent(null)}
      />
    </div>
  );
}
