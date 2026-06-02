"use client";

import * as React from "react";
import { Circle, Film, Mic, Square, Video } from "lucide-react";
import {
  concertPerformanceRecorder,
  type ConcertPerformanceRecorderStatus,
} from "@/lib/concert/concertPerformanceRecorder";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";

function formatElapsed(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export function ConcertPerformanceRecorderPanel({
  stageRef,
}: {
  stageRef: React.RefObject<HTMLElement | null>;
}) {
  const [status, setStatus] = React.useState<ConcertPerformanceRecorderStatus>(
    concertPerformanceRecorder.status(),
  );
  const [includeTabAudio, setIncludeTabAudio] = React.useState(false);
  const [includeMic, setIncludeMic] = React.useState(true);
  const [includeWasm, setIncludeWasm] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  React.useEffect(() => concertPerformanceRecorder.subscribe(setStatus), []);

  const start = async (mode: "video" | "audio") => {
    setBusy(true);
    setMessage(null);
    const res = await concertPerformanceRecorder.start({
      mode,
      stageElement: stageRef.current,
      includeMic,
      includeWasmTap: includeWasm,
      includeTabAudio,
    });
    setBusy(false);
    if (!res.ok) setMessage(res.error ?? "Could not start recording.");
  };

  const stop = async () => {
    setBusy(true);
    await concertPerformanceRecorder.stopAndDownload();
    setBusy(false);
    setMessage("Saved to Downloads.");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle
          icon={<Film className="h-4 w-4" />}
          description="Capture the stage visualizer and/or performance audio to disk (WebM in most browsers)."
          actions={
            status.recording ? (
              <Badge tone="rose" dot>
                REC {formatElapsed(status.elapsedMs)}
              </Badge>
            ) : null
          }
        >
          Performance recording
        </CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            size="sm"
            disabled={busy || status.recording}
            leftIcon={<Video className="h-4 w-4" />}
            onClick={() => void start("video")}
          >
            Record movie
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy || status.recording}
            leftIcon={<Mic className="h-4 w-4" />}
            onClick={() => void start("audio")}
          >
            Record audio only
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy || !status.recording}
            leftIcon={<Square className="h-4 w-4" />}
            onClick={() => void stop()}
          >
            Stop &amp; download
          </Button>
        </div>

        <div className="grid gap-2 text-xs text-zinc-400 sm:grid-cols-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeMic}
              onChange={(e) => setIncludeMic(e.target.checked)}
              disabled={status.recording}
            />
            Microphone
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeWasm}
              onChange={(e) => setIncludeWasm(e.target.checked)}
              disabled={status.recording}
            />
            Browser WASM Csound
          </label>
          <label className="flex items-center gap-2" title="Share this tab with audio — needed for headless NIME Csound">
            <input
              type="checkbox"
              checked={includeTabAudio}
              onChange={(e) => setIncludeTabAudio(e.target.checked)}
              disabled={status.recording}
            />
            Tab audio (headless)
          </label>
        </div>

        <p className="text-[11px] leading-5 text-zinc-500">
          <Circle className="mr-1 inline h-3 w-3 text-rose-400" />
          Movie capture uses the stage canvas at 30&nbsp;fps plus selected audio sources. Headless Csound does not
          appear in the browser audio graph — enable <strong className="text-zinc-400">Tab audio</strong> and pick
          this NeuroVis tab when prompted.
        </p>

        {message && (
          <p className="text-xs text-zinc-300" role="status">
            {message}
          </p>
        )}
        {status.error && (
          <p className="text-xs text-rose-300" role="alert">
            {status.error}
          </p>
        )}
      </CardBody>
    </Card>
  );
}
