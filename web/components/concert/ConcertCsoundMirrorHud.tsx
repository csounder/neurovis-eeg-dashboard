"use client";

import * as React from "react";
import { Radio } from "lucide-react";
import { useConcertCsoundMirror } from "@/lib/useConcertCsoundMirror";
import { cn } from "@/lib/utils";

const PRIORITY_CC = [28, 27, 26, 1, 21, 22, 23, 24, 25];

export function ConcertCsoundMirrorHud({
  enabled,
  compact = false,
  running = false,
}: {
  enabled: boolean;
  compact?: boolean;
  running?: boolean;
}) {
  const { cc, messages } = useConcertCsoundMirror();
  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  if (!enabled) return null;

  const sortedCc = [...cc].sort((a, b) => {
    const ai = PRIORITY_CC.indexOf(a.cc);
    const bi = PRIORITY_CC.indexOf(b.cc);
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return a.cc - b.cc;
  });

  const hasData = sortedCc.length > 0 || messages.length > 0;

  return (
    <div
      className={cn(
        "pointer-events-none absolute z-10 flex flex-col",
        compact ? "right-3 top-3 max-w-[min(92%,380px)]" : "right-4 top-4 max-w-[min(92%,460px)]",
      )}
    >
      <div
        className={cn(
          "rounded-xl border border-indigo-500/35 bg-black/78 font-mono shadow-lg backdrop-blur-md",
          compact ? "text-[10px] leading-[1.35]" : "text-xs leading-snug",
        )}
      >
        <div
          className={cn(
            "flex items-center gap-1.5 border-b border-zinc-800/80 px-2 py-1 text-indigo-200/90",
            compact ? "text-[8px]" : "text-[9px]",
          )}
        >
          <Radio className={cn(compact ? "h-2.5 w-2.5" : "h-3 w-3")} />
          <span className="font-semibold uppercase tracking-wider">Csound</span>
          <span className="text-zinc-500">
            {running ? "live" : "idle"}
          </span>
        </div>

        {sortedCc.length > 0 && (
          <div className="grid grid-cols-1 gap-0.5 px-2.5 py-2">
            {sortedCc.slice(0, compact ? 12 : 16).map((row) => (
              <div key={row.cc} className="flex gap-1 text-zinc-300">
                <span className="shrink-0 text-emerald-400/90">CC{row.cc}</span>
                <span className="truncate text-zinc-400" title={row.label}>
                  {row.value ?? row.label.replace(/^.*?CC\d+\s*/i, "").slice(0, compact ? 28 : 48)}
                </span>
              </div>
            ))}
          </div>
        )}

        <div
          ref={scrollRef}
          className={cn(
            "max-h-32 overflow-y-auto border-t border-zinc-800/60 px-2.5 py-1.5 text-emerald-100/90",
            compact && "max-h-24",
            !hasData && "text-zinc-600",
          )}
        >
          {!hasData ? (
            <span>
              {running
                ? "Waiting for printks / CC…"
                : "Start a NIME patch to mirror orchestra text here."}
            </span>
          ) : (
            messages.slice(compact ? -6 : -10).map((msg, i) => (
              <div key={`${i}-${msg.slice(0, 24)}`} className="truncate" title={msg}>
                {msg}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
