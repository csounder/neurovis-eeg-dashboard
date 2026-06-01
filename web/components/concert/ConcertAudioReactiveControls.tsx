"use client";

import * as React from "react";
import { Radio, Waves } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Slider } from "@/components/ui/Slider";
import type { ConcertAudioReactiveMode } from "@/lib/concertAudioBlend";
import {
  getConcertAudioLevel,
  setConcertAudioReactiveMode,
  startConcertMicTap,
  stopConcertMicTap,
} from "@/lib/concertAudioMeter";

const MODES: {
  id: ConcertAudioReactiveMode;
  label: string;
  hint: string;
}[] = [
  {
    id: "blend",
    label: "Blend (mic + WASM)",
    hint: "Uses the louder of mic or browser Csound as the audio tap; mix with EEG via the slider below.",
  },
  {
    id: "mic",
    label: "Mic tap",
    hint: "Mac mic picks up speakers (headless Csound or CsoundQt in the room).",
  },
  {
    id: "wasm",
    label: "Browser Csound",
    hint: "RMS from V12 WASM below — start that engine first.",
  },
  {
    id: "eeg",
    label: "EEG bands only",
    hint: "All scenes still use EEG bands; audio tap weight is 0% (EEG envelope only).",
  },
];

export function ConcertAudioReactiveControls({
  mode,
  onModeChange,
  eegReactive,
  wasmCsoundRunning,
  arAudioMix,
  onArAudioMixChange,
  embedded = false,
}: {
  mode: ConcertAudioReactiveMode;
  onModeChange: (mode: ConcertAudioReactiveMode) => void;
  eegReactive: boolean;
  wasmCsoundRunning: boolean;
  /** 0 = EEG drives AR, 1 = audio tap drives AR. */
  arAudioMix: number;
  onArAudioMixChange: (v: number) => void;
  /** When true, omit outer Card (parent provides section heading). */
  embedded?: boolean;
}) {
  const [micOn, setMicOn] = React.useState(false);
  const [micError, setMicError] = React.useState<string | null>(null);
  const [level, setLevel] = React.useState(0);

  React.useEffect(() => {
    setConcertAudioReactiveMode(mode);
  }, [mode]);

  React.useEffect(() => {
    let cancelled = false;
    async function syncMic() {
      if (mode === "mic" || mode === "blend") {
        const res = await startConcertMicTap();
        if (cancelled) return;
        if (res.ok) {
          setMicOn(true);
          setMicError(null);
        } else {
          setMicOn(false);
          setMicError(res.error ?? "Mic failed");
        }
      } else {
        stopConcertMicTap();
        setMicOn(false);
        setMicError(null);
      }
    }
    void syncMic();
    return () => {
      cancelled = true;
      stopConcertMicTap();
      setMicOn(false);
    };
  }, [mode]);

  React.useEffect(() => {
    const id = window.setInterval(() => setLevel(getConcertAudioLevel()), 80);
    return () => window.clearInterval(id);
  }, []);

  async function retryMic() {
    const res = await startConcertMicTap();
    if (res.ok) {
      setMicOn(true);
      setMicError(null);
    } else {
      setMicError(res.error ?? "Mic failed");
    }
  }

  const modeHint = MODES.find((m) => m.id === mode)?.hint ?? "";
  const eegPct = Math.round((1 - arAudioMix) * 100);
  const audioPct = Math.round(arAudioMix * 100);

  const body = (
    <>
        <div className="grid gap-2 sm:grid-cols-2">
          {MODES.map((m) => (
            <label
              key={m.id}
              className={`flex cursor-pointer gap-2 rounded-lg border px-3 py-2 text-xs ${
                mode === m.id
                  ? "border-emerald-500/50 bg-emerald-500/10 text-zinc-100"
                  : "border-zinc-800 bg-zinc-950/40 text-zinc-400"
              }`}
            >
              <input
                type="radio"
                name="concert-ar-mode"
                className="mt-0.5"
                checked={mode === m.id}
                onChange={() => onModeChange(m.id)}
              />
              <span>
                <span className="font-medium text-zinc-200">{m.label}</span>
                <span className="mt-0.5 block leading-snug text-zinc-500">{m.hint}</span>
              </span>
            </label>
          ))}
        </div>

        <p className="text-[11px] leading-5 text-zinc-500">{modeHint}</p>

        <Slider
          label="Audio ↔ EEG in AR visuals"
          value={arAudioMix}
          min={0}
          max={1}
          step={0.01}
          onChange={onArAudioMixChange}
          format={() => `${audioPct}% audio · ${eegPct}% EEG`}
          disabled={mode === "eeg"}
        />
        {mode === "eeg" && (
          <p className="text-[10px] text-zinc-600 -mt-2">
            EEG-only mode — mix slider has no effect (100% band envelope).
          </p>
        )}

        {(mode === "mic" || mode === "blend") && (
          <div className="flex flex-wrap items-center gap-2">
            {micOn ? (
              <Badge tone="emerald" dot>
                Mic tap live
              </Badge>
            ) : (
              <Badge tone="amber">Mic waiting</Badge>
            )}
            {micError && (
              <>
                <span className="text-xs text-rose-300">{micError}</span>
                <Button variant="outline" size="sm" onClick={() => void retryMic()}>
                  Retry mic
                </Button>
              </>
            )}
            <span className="text-[10px] text-zinc-600">
              Allow microphone when prompted (picks up room / speakers).
            </span>
          </div>
        )}

        {(mode === "wasm" || mode === "blend") && (
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Radio className="h-3.5 w-3.5 text-indigo-300" />
            Browser Csound meter:{" "}
            {wasmCsoundRunning ? (
              <span className="text-emerald-300">running</span>
            ) : (
              <span className="text-amber-200/90">idle — Start Audio in V12 block below</span>
            )}
          </div>
        )}

        {eegReactive && (
          <p className="text-[11px] text-zinc-500">
            Live EEG stream — raise <strong className="text-zinc-400">EEG</strong> on the mix slider to tie AR motion to bands.
          </p>
        )}

        {!embedded && (
          <p className="text-[10px] leading-5 text-zinc-600">
            Pick audioreactive scenes above. Number keys go to NIME sensekey when a headless patch runs.
          </p>
        )}
    </>
  );

  if (embedded) {
    return <div className="space-y-4">{body}</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle
          icon={<Waves className="h-4 w-4" />}
          description="All scenes: pick audio source and how much audio vs EEG drives motion."
          actions={
            <Badge tone={level > 0.08 ? "emerald" : "neutral"}>
              AR level {(level * 100).toFixed(0)}%
            </Badge>
          }
        >
          Audioreactive source
        </CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">{body}</CardBody>
    </Card>
  );
}
