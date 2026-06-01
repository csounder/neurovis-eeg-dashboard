"use client";

import * as React from "react";
import { X } from "lucide-react";
import { ConcertVisualTuningPanel } from "@/components/concert/ConcertVisualTuningPanel";
import type { ConcertAudioReactiveMode } from "@/lib/concertAudioBlend";
import type { ConcertVisualTuning } from "@/lib/concertVisualTuning";
import { Button } from "@/components/ui/Button";

export function ConcertStageTuningHud({
  open,
  onClose,
  visualTuning,
  onTuningChange,
  intensity,
  onIntensityChange,
  trails,
  onTrailsChange,
  arMode,
  onArModeChange,
  eegReactive,
  wasmCsoundRunning,
}: {
  open: boolean;
  onClose: () => void;
  visualTuning: ConcertVisualTuning;
  onTuningChange: (patch: Partial<ConcertVisualTuning>) => void;
  intensity: number;
  onIntensityChange: (v: number) => void;
  trails: number;
  onTrailsChange: (v: number) => void;
  arMode: ConcertAudioReactiveMode;
  onArModeChange: (mode: ConcertAudioReactiveMode) => void;
  eegReactive: boolean;
  wasmCsoundRunning: boolean;
}) {
  if (!open) return null;

  return (
    <div className="pointer-events-auto absolute inset-x-3 bottom-3 top-auto z-20 max-h-[min(52%,420px)] overflow-y-auto rounded-xl border border-emerald-500/30 bg-black/82 p-3 shadow-2xl backdrop-blur-md">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300/90">
          Tuning HUD
        </span>
        <Button variant="outline" size="sm" onClick={onClose} aria-label="Hide tuning HUD">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <ConcertVisualTuningPanel
        dense
        visualTuning={visualTuning}
        onTuningChange={onTuningChange}
        intensity={intensity}
        onIntensityChange={onIntensityChange}
        trails={trails}
        onTrailsChange={onTrailsChange}
        arMode={arMode}
        onArModeChange={onArModeChange}
        eegReactive={eegReactive}
        wasmCsoundRunning={wasmCsoundRunning}
      />
    </div>
  );
}
