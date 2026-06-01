"use client";

import * as React from "react";
import { Terminal } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useNeuroStore } from "@/lib/store";
import { wsSend } from "@/lib/useWebSocket";
import { api } from "@/lib/api";
import type { CsoundConsoleLine } from "@/lib/types";

function mergeCsoundConsoleFromApi(prev: CsoundConsoleLine[], incoming: CsoundConsoleLine[]) {
  const seen = new Set(prev.map((l) => l.id));
  const merged = [...prev];
  for (const line of incoming) {
    if (seen.has(line.id)) continue;
    seen.add(line.id);
    merged.push(line);
  }
  return merged.slice(-800);
}

export function ConcertCsoundConsole({ running }: { running: boolean }) {
  const lines = useNeuroStore((s) => s.csoundConsoleLines);
  const scrollRef = React.useRef<HTMLPreElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lines]);

  React.useEffect(() => {
    if (!running) return;
    void api.csoundConsole().then((data) => {
      const payload = data as { lines?: typeof lines };
      if (payload.lines?.length) {
        useNeuroStore.setState((st) => ({
          csoundConsoleLines: mergeCsoundConsoleFromApi(st.csoundConsoleLines, payload.lines!),
        }));
      }
    });
  }, [running]);

  function sendLine(text: string) {
    if (!text) return;
    wsSend({ type: "csound_stdin", text: `${text}\n` });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle
          icon={<Terminal className="h-4 w-4" />}
          description="printks and sensekey feedback from the headless patch. Keys typed here (or anywhere on this page except form fields) are sent to Csound."
          actions={
            <Badge tone={running ? "emerald" : "neutral"} dot>
              {running ? "Console live" : "Start a patch"}
            </Badge>
          }
        >
          Csound console
        </CardTitle>
      </CardHeader>
      <CardBody className="space-y-3">
        <pre
          ref={scrollRef}
          className="max-h-64 overflow-auto rounded-lg border border-zinc-800 bg-black/80 p-3 font-mono text-[11px] leading-5 text-emerald-100/90 whitespace-pre-wrap break-words"
          aria-live="polite"
        >
          {lines.length === 0 ? (
            <span className="text-zinc-600">
              {running
                ? "Waiting for Csound messages…"
                : "Start a NIME patch to see orchestra printks (band ranges, mode changes, etc.)."}
            </span>
          ) : (
            lines.map((line, index) => (
              <span
                key={`${line.id}-${index}`}
                className={line.stream === "stderr" ? "text-amber-200/90" : undefined}
              >
                {line.text}
                {"\n"}
              </span>
            ))
          )}
        </pre>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const input = inputRef.current;
            if (!input || !running) return;
            sendLine(input.value);
            input.value = "";
          }}
        >
          <input
            ref={inputRef}
            type="text"
            disabled={!running}
            placeholder={running ? "Type a sensekey command (e.g. 1, d, p)…" : "Start patch first"}
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 disabled:opacity-50"
            autoComplete="off"
            spellCheck={false}
          />
        </form>
        <p className="text-[10px] leading-5 text-zinc-600">
          Concert scene hotkeys are off so <kbd className="text-zinc-500">1–0</kbd>,{" "}
          <kbd className="text-zinc-500">d/t/a/b</kbd>, and <kbd className="text-zinc-500">p</kbd> go to your
          .csd sensekey. Pick visuals with the scene buttons above.
        </p>
      </CardBody>
    </Card>
  );
}
