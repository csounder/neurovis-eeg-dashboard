"use client";

import * as React from "react";
import { Shuffle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConcertSceneRotationSettings } from "@/lib/concert/concertSceneRotation";

type Props = {
  settings: ConcertSceneRotationSettings;
  onChange: (next: ConcertSceneRotationSettings) => void;
  className?: string;
  compact?: boolean;
};

export function ConcertSceneRotationControls({ settings, onChange, className, compact }: Props) {
  const setEnabled = (enabled: boolean) => onChange({ ...settings, enabled });
  const setSeconds = (intervalSeconds: number) => onChange({ ...settings, intervalSeconds });

  return (
    <div
      className={cn(
        "rounded-xl border border-zinc-800 bg-zinc-950/50",
        compact ? "px-3 py-2.5" : "px-4 py-3",
        className,
      )}
    >
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-emerald-500 focus:ring-emerald-500/40"
          checked={settings.enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-sm font-medium text-zinc-100">
            <Shuffle className="h-4 w-4 text-emerald-400/90" />
            Random scene rotation
          </span>
          <span className="mt-0.5 block text-xs text-zinc-500">
            Automatically switch to a random visualization on a timer (saved in this browser).
          </span>
        </span>
      </label>

      <div
        className={cn(
          "mt-3 flex flex-wrap items-end gap-3 border-t border-zinc-800/80 pt-3",
          !settings.enabled && "pointer-events-none opacity-45",
        )}
      >
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          Interval (seconds)
          <input
            type="number"
            min={8}
            max={600}
            step={1}
            className="w-28 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            value={settings.intervalSeconds}
            onChange={(e) => setSeconds(Number(e.target.value))}
          />
        </label>
        <p className="pb-2 text-[11px] text-zinc-600">8–600 s · all {compact ? "" : "concert "}scenes in the pool</p>
      </div>
    </div>
  );
}
