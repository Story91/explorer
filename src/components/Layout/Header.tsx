"use client";

import { Pulse } from "@/components/ui/Pulse";

interface HeaderProps {
  connected: boolean;
  dataMode?: "live" | "mock" | "error";
}

export function Header({ connected, dataMode = "live" }: HeaderProps) {
  const dataTone =
    dataMode === "live"
      ? "text-neon-green border-neon-green/20 bg-neon-green/10"
      : dataMode === "mock"
      ? "text-neon-amber border-neon-amber/20 bg-neon-amber/10"
      : "text-neon-red border-neon-red/20 bg-neon-red/10";

  const dataLabel =
    dataMode === "live" ? "Data: Live" : dataMode === "mock" ? "Data: Mock" : "Data: Error";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/5">
      <div className="mx-auto flex h-14 max-w-[1920px] items-center justify-between px-4 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight neon-text-cyan">
              0x01
            </span>
            <span className="text-sm font-medium text-white/60">
              Mesh Explorer
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className={`hidden rounded-full border px-3 py-1.5 text-xs font-semibold sm:block ${dataTone}`}>
            {dataLabel}
          </div>
          <div className="flex items-center gap-2 rounded-full glass px-3 py-1.5">
            <Pulse
              color={connected ? "bg-neon-green" : "bg-neon-red"}
              size="sm"
            />
            <span className="text-xs font-medium text-white/60">
              {connected ? "Live" : "Connecting..."}
            </span>
          </div>
          <a
            href="https://0x01.world"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden rounded-full bg-neon-cyan/10 px-4 py-1.5 text-xs font-semibold text-neon-cyan border border-neon-cyan/20 transition-all hover:bg-neon-cyan/20 hover:shadow-[0_0_20px_rgba(0,240,255,0.15)] sm:block"
          >
            Get API Key
          </a>
        </div>
      </div>
    </header>
  );
}
