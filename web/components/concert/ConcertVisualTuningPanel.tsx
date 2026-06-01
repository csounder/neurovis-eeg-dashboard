"use client";

import { SlidersHorizontal } from "lucide-react";
import { ConcertAudioReactiveControls } from "@/components/concert/ConcertAudioReactiveControls";
import type { ConcertAudioReactiveMode } from "@/lib/concertAudioBlend";
import type { ConcertVisualTuning } from "@/lib/concertVisualTuning";
import { Slider } from "@/components/ui/Slider";

export function ConcertVisualTuningPanel({
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
  dense = false,
}: {
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
  dense?: boolean;
}) {
  const grid = dense
    ? "grid gap-3 sm:grid-cols-2"
    : "grid gap-4 md:grid-cols-2 lg:grid-cols-4";

  return (
    <div className="space-y-4">
      <div className={grid}>
        <Slider
          label="EEG sensitivity"
          value={visualTuning.eegSensitivity}
          min={0.25}
          max={3}
          step={0.05}
          onChange={(v) => onTuningChange({ eegSensitivity: v })}
          format={(v) => `${v.toFixed(2)}×`}
        />
        <Slider
          label="Visual size"
          value={visualTuning.visualScale}
          min={0.5}
          max={2}
          step={0.05}
          onChange={(v) => onTuningChange({ visualScale: v })}
          format={(v) => `${v.toFixed(2)}×`}
        />
        <Slider
          label="Canvas brightness"
          value={visualTuning.brightness}
          min={0.35}
          max={2}
          step={0.05}
          onChange={(v) => onTuningChange({ brightness: v })}
          format={(v) => `${v.toFixed(2)}×`}
        />
        <Slider
          label="EEG influence"
          value={visualTuning.eegInfluence}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => onTuningChange({ eegInfluence: v })}
          format={(v) => `${Math.round(v * 100)}%`}
        />
        <Slider
          label="Animation speed"
          value={visualTuning.motionActivity}
          min={0.25}
          max={2.5}
          step={0.05}
          onChange={(v) => onTuningChange({ motionActivity: v })}
          format={(v) => `${v.toFixed(2)}×`}
        />
        <Slider
          label="Stage intensity"
          value={intensity}
          min={0.25}
          max={2.25}
          step={0.01}
          onChange={onIntensityChange}
          format={(v) => `${v.toFixed(2)}×`}
        />
        <Slider
          label="Light trails"
          value={trails}
          min={0.68}
          max={0.97}
          step={0.01}
          onChange={onTrailsChange}
          format={(v) => v.toFixed(2)}
        />
      </div>

      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
        <SlidersHorizontal className="h-3.5 w-3.5 text-violet-400" />
        WebGL (fullscreen + TF particles)
      </div>
      <div className={grid}>
        <Slider
          label="GL brightness"
          value={visualTuning.glBrightness}
          min={0.35}
          max={2.5}
          step={0.05}
          onChange={(v) => onTuningChange({ glBrightness: v })}
          format={(v) => `${v.toFixed(2)}×`}
        />
        <Slider
          label="GL motion"
          value={visualTuning.glMotion}
          min={0.4}
          max={2.5}
          step={0.05}
          onChange={(v) => onTuningChange({ glMotion: v })}
          format={(v) => `${v.toFixed(2)}×`}
        />
        <Slider
          label="GL particle glow"
          value={visualTuning.glParticleGlow}
          min={0.5}
          max={2}
          step={0.05}
          onChange={(v) => onTuningChange({ glParticleGlow: v })}
          format={(v) => `${v.toFixed(2)}×`}
        />
      </div>

      {!dense && (
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
          <SlidersHorizontal className="h-3.5 w-3.5 text-cyan-400" />
          Audio + EEG drive (all scenes)
        </div>
      )}
      <ConcertAudioReactiveControls
        embedded
        mode={arMode}
        onModeChange={onArModeChange}
        eegReactive={eegReactive}
        wasmCsoundRunning={wasmCsoundRunning}
        arAudioMix={visualTuning.arAudioMix}
        onArAudioMixChange={(v) => onTuningChange({ arAudioMix: v })}
      />
    </div>
  );
}
