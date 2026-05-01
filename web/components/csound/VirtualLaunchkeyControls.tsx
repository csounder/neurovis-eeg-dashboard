"use client";

import * as React from "react";

export const LAUNCHKEY_DEFAULT_START_NOTE = 48;
export const LAUNCHKEY_KEY_COUNT = 25;
export const LAUNCHKEY_CC_NUMBERS = [21, 22, 23, 24, 25, 26, 27, 28] as const;

/** Top row of the 4×2 CC knob grid (21–24 above 25–28) */
export const LAUNCHKEY_CC_ROW_TOP = [...LAUNCHKEY_CC_NUMBERS.slice(0, 4)] as const;
export const LAUNCHKEY_CC_ROW_BOTTOM = [...LAUNCHKEY_CC_NUMBERS.slice(4, 8)] as const;

const ASCII_KEYBOARD_OFFSETS: Record<string, number> = {
  a: 0,
  w: 1,
  s: 2,
  e: 3,
  d: 4,
  f: 5,
  t: 6,
  g: 7,
  y: 8,
  h: 9,
  u: 10,
  j: 11,
  k: 12,
  o: 13,
  l: 14,
  p: 15,
  ";": 16,
  "'": 17,
};

export function midiNoteName(note: number) {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const pitch = names[((note % 12) + 12) % 12];
  const octave = Math.floor(note / 12) - 1;
  return `${pitch}${octave}`;
}

export function VirtualKnob({
  cc,
  value,
  onChange,
}: {
  cc: number;
  value: number;
  onChange: (value: number) => void;
}) {
  const angle = -135 + value * 270;
  return (
    <label className="flex flex-col items-center gap-0.5 rounded-lg border border-zinc-800 bg-zinc-950/60 p-1.5">
      <span className="font-mono text-[10px] text-zinc-400">CC{cc}</span>
      <span
        className="relative h-8 w-8 rounded-full border border-zinc-700 bg-zinc-900 shadow-inner"
        style={{
          background: `conic-gradient(from 225deg, rgb(16 185 129) ${value * 270}deg, rgb(39 39 42) 0deg)`,
        }}
      >
        <span
          className="absolute left-1/2 top-1/2 h-3 w-0.5 origin-bottom rounded bg-zinc-100"
          style={{
            transform: `translate(-50%, -100%) rotate(${angle}deg)`,
          }}
        />
      </span>
      <input
        aria-label={`CC ${cc}`}
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-emerald-500"
      />
      <span className="font-mono text-[10px] text-zinc-500">{Math.round(value * 127)}</span>
    </label>
  );
}

export function VerticalControl({
  label,
  value,
  min,
  max,
  step,
  center,
  onChange,
  size = "default",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  center?: boolean;
  onChange: (value: number) => void;
  /** `large` — taller vertical slider for standalone CC1 / mod wheel */
  size?: "default" | "large";
}) {
  const sliderClass =
    size === "large"
      ? "h-36 w-9 -rotate-90 accent-emerald-500 sm:h-40 xl:h-44"
      : "h-16 w-7 -rotate-90 accent-emerald-500 xl:h-20";
  return (
    <label className="flex flex-col items-center gap-1">
      <span className="text-center font-mono text-[10px] text-zinc-400">{label}</span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        onDoubleClick={() => center && onChange(0)}
        className={sliderClass}
      />
      <span className="min-h-[1rem] text-center font-mono text-[10px] text-zinc-500">
        {center ? value.toFixed(2) : Math.round(value * 127)}
      </span>
    </label>
  );
}

export function MiniKeyboard({
  startNote,
  disabled,
  heldNotes,
  onNoteOn,
  onNoteOff,
}: {
  startNote: number;
  disabled: boolean;
  heldNotes: Set<number>;
  onNoteOn: (note: number) => void;
  onNoteOff: (note: number) => void;
}) {
  const [asciiActive, setAsciiActive] = React.useState(false);
  const asciiHeldRef = React.useRef<Map<string, number>>(new Map());
  const keys = Array.from({ length: LAUNCHKEY_KEY_COUNT }, (_, index) => startNote + index);
  const blackOffsets = new Set([1, 3, 6, 8, 10]);
  const whiteKeys = keys.filter((note) => !blackOffsets.has(note % 12));
  const blackKeys = keys.filter((note) => blackOffsets.has(note % 12));
  const asciiLabels = React.useMemo(() => {
    const labels = new Map<number, string>();
    Object.entries(ASCII_KEYBOARD_OFFSETS).forEach(([key, offset]) => {
      labels.set(startNote + offset, key === " " ? "Space" : key.toUpperCase());
    });
    return labels;
  }, [startNote]);
  const releaseAsciiHeldNotes = React.useCallback(() => {
    for (const note of asciiHeldRef.current.values()) {
      onNoteOff(note);
    }
    asciiHeldRef.current.clear();
  }, [onNoteOff]);

  React.useEffect(() => {
    if (!asciiActive || disabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLSelectElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      const offset = ASCII_KEYBOARD_OFFSETS[event.key.toLowerCase()];
      if (offset === undefined) return;
      const note = startNote + offset;
      if (note > startNote + LAUNCHKEY_KEY_COUNT - 1) return;
      event.preventDefault();
      event.stopPropagation();
      const key = event.key.toLowerCase();
      if (asciiHeldRef.current.has(key)) return;
      asciiHeldRef.current.set(key, note);
      onNoteOn(note);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const note = asciiHeldRef.current.get(key);
      if (note === undefined) return;
      event.preventDefault();
      event.stopPropagation();
      asciiHeldRef.current.delete(key);
      onNoteOff(note);
    };
    const onWindowBlur = () => releaseAsciiHeldNotes();
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        releaseAsciiHeldNotes();
      }
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    window.addEventListener("keyup", onKeyUp, { capture: true });
    window.addEventListener("blur", onWindowBlur);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      releaseAsciiHeldNotes();
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      window.removeEventListener("keyup", onKeyUp, { capture: true });
      window.removeEventListener("blur", onWindowBlur);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [asciiActive, disabled, onNoteOff, onNoteOn, releaseAsciiHeldNotes, startNote]);

  return (
    <div
      className={[
        "rounded-xl border bg-zinc-950/70 p-2 transition",
        asciiActive ? "border-emerald-500/70 shadow-[0_0_28px_-18px_rgba(16,185,129,.95)]" : "border-zinc-800",
      ].join(" ")}
      onMouseEnter={() => setAsciiActive(true)}
      onMouseLeave={() => setAsciiActive(false)}
      onFocus={() => setAsciiActive(true)}
      onBlur={() => setAsciiActive(false)}
      tabIndex={0}
    >
      <div className="mb-2 flex items-center justify-between gap-3 text-[11px]">
        <span className="text-zinc-500">Hover/focus here for ASCII keyboard notes</span>
        <span className={asciiActive ? "text-emerald-300" : "text-zinc-600"}>
          {asciiActive ? "ASCII notes active" : "ASCII shortcuts dormant"}
        </span>
      </div>
      <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/80 p-2">
        <div className="relative h-36 w-full sm:h-40">
          <div className="absolute inset-x-0 bottom-0 flex h-full gap-0.5">
            {whiteKeys.map((note) => {
              const held = heldNotes.has(note);
              return (
                <button
                  key={note}
                  type="button"
                  disabled={disabled}
                  className={[
                    "touch-none flex min-w-0 flex-1 flex-col justify-end rounded-b-md border border-zinc-500 bg-zinc-100 px-0.5 pb-2 text-center font-mono text-[9px] text-zinc-900 transition hover:bg-emerald-100 disabled:opacity-35 sm:text-[10px]",
                    held ? "border-emerald-400 bg-emerald-300 text-zinc-950 shadow-[0_0_20px_-8px_rgba(16,185,129,.95)]" : "",
                  ].join(" ")}
                  onMouseDown={() => onNoteOn(note)}
                  onMouseUp={() => onNoteOff(note)}
                  onMouseLeave={() => held && onNoteOff(note)}
                  onTouchStart={() => onNoteOn(note)}
                  onTouchEnd={() => onNoteOff(note)}
                  title={midiNoteName(note)}
                >
                  <span>{midiNoteName(note)}</span>
                  {asciiLabels.has(note) && (
                    <span className="mt-1 rounded bg-zinc-300/80 px-1 text-[8px] text-zinc-700">
                      {asciiLabels.get(note)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {blackKeys.map((note) => {
            const precedingWhiteIndex = whiteKeys.filter((whiteNote) => whiteNote < note).length - 1;
            const leftPct = ((precedingWhiteIndex + 0.92) / whiteKeys.length) * 100;
            const held = heldNotes.has(note);
            return (
              <button
                key={note}
                type="button"
                disabled={disabled}
                className={[
                  "absolute top-0 z-10 touch-none flex h-24 -translate-x-1/2 flex-col items-center justify-end rounded-b-md border border-zinc-950 bg-zinc-950 pb-2 font-mono text-[8px] text-zinc-500 shadow-lg transition hover:bg-zinc-800 disabled:opacity-35 sm:h-28 sm:text-[9px]",
                  held ? "border-emerald-400 bg-emerald-300 text-zinc-950 shadow-[0_0_20px_-8px_rgba(16,185,129,.95)]" : "",
                ].join(" ")}
                style={{
                  left: `${leftPct}%`,
                  width: `min(34px, ${Math.max(4.2, 58 / whiteKeys.length)}%)`,
                }}
                onMouseDown={() => onNoteOn(note)}
                onMouseUp={() => onNoteOff(note)}
                onMouseLeave={() => held && onNoteOff(note)}
                onTouchStart={() => onNoteOn(note)}
                onTouchEnd={() => onNoteOff(note)}
                title={midiNoteName(note)}
              >
                <span className="sr-only">{midiNoteName(note)}</span>
                {asciiLabels.has(note) && <span>{asciiLabels.get(note)}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
