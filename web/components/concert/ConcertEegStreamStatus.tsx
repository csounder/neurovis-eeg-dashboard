"use client";

import * as React from "react";
import { Activity, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useNeuroStore } from "@/lib/store";

const STALE_MS = 3500;

export function ConcertEegStreamStatus({ compact = false }: { compact?: boolean }) {
  const wsStatus = useNeuroStore((s) => s.wsStatus);
  const lastMessageAt = useNeuroStore((s) => s.lastMessageAt);
  const latestBandsAt = useNeuroStore((s) => s.latestBandsAt);
  const estimatedEegHz = useNeuroStore((s) => s.estimatedEegHz);
  const requestWsReconnect = useNeuroStore((s) => s.requestWsReconnect);
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  const streamAge = lastMessageAt ? now - lastMessageAt : null;
  const bandAge = latestBandsAt ? now - latestBandsAt : null;
  const streamStale =
    wsStatus === "open" && streamAge !== null && streamAge > STALE_MS;
  const bandsStale =
    wsStatus === "open" && bandAge !== null && bandAge > STALE_MS * 2;
  const live =
    wsStatus === "open" && streamAge !== null && streamAge <= STALE_MS;

  const tone = live ? "emerald" : wsStatus === "open" ? "amber" : "rose";

  return (
    <div
      className={
        compact
          ? "flex flex-wrap items-center gap-2"
          : "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2"
      }
    >
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge tone={tone} dot>
          {live ? "EEG streaming" : wsStatus === "open" ? "EEG stale" : `WS ${wsStatus}`}
        </Badge>
        {estimatedEegHz != null && (
          <span className="font-mono text-zinc-500">~{estimatedEegHz.toFixed(1)} Hz</span>
        )}
        {streamAge !== null && wsStatus === "open" && (
          <span className="text-zinc-600">
            last packet {(streamAge / 1000).toFixed(1)}s ago
          </span>
        )}
        {(streamStale || bandsStale) && (
          <span className="text-amber-200/90">
            {bandsStale && !streamStale ? "Bands paused — " : ""}
            Check Muse bridge or reconnect
          </span>
        )}
      </div>
      {(streamStale || wsStatus !== "open") && (
        <Button
          variant="outline"
          size="sm"
          leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          onClick={() => requestWsReconnect()}
        >
          Reconnect WS
        </Button>
      )}
      {!compact && (
        <span className="flex items-center gap-1 text-[10px] text-zinc-600">
          <Activity className="h-3 w-3" />
          Sliders do not stop the stream — if visuals freeze, reconnect here.
        </span>
      )}
    </div>
  );
}
