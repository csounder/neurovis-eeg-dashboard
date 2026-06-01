"use client";

import * as React from "react";
import { Music2, Play, Square, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { useNeuroStore } from "@/lib/store";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";

export type NimePatch = {
  id: string;
  filename: string;
  library: string;
  name: string;
  oscPort: number;
  mindMonitor4Float: boolean;
  usesMidi?: boolean;
};

type PatchLibraries = {
  nime: NimePatch[];
  examples: NimePatch[];
};

export type ConcertNimePatchPanelHandle = {
  /** Step patch (−1 prev, +1 next) and launch headless Csound for the new selection. */
  stepPatch: (delta: -1 | 1) => void;
};

export const ConcertNimePatchPanel = React.forwardRef<
  ConcertNimePatchPanelHandle,
  {
    onRunningChange?: (running: boolean) => void;
    /** True when a patch is selected/launched (headless or CsoundQt). */
    onPatchSessionChange?: (active: boolean) => void;
  }
>(function ConcertNimePatchPanel({ onRunningChange, onPatchSessionChange }, ref) {
  const [patches, setPatches] = React.useState<NimePatch[]>([]);
  const [selectedId, setSelectedId] = React.useState("");
  const [running, setRunning] = React.useState(false);
  const [current, setCurrent] = React.useState<string | null>(null);
  const [oscTarget, setOscTarget] = React.useState("127.0.0.1:7400");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const stepInFlight = React.useRef(false);

  const refresh = React.useCallback(async () => {
    try {
      const data = (await api.csoundPatches()) as {
        libraries: PatchLibraries;
        running?: boolean;
        current?: string | null;
        oscTarget?: string;
      };
      const nime = data.libraries?.nime ?? [];
      setPatches(nime);
      setRunning(!!data.running);
      setCurrent(data.current ?? null);
      if (data.oscTarget) setOscTarget(data.oscTarget);
      const isRunning = !!data.running;
      onRunningChange?.(isRunning);
      onPatchSessionChange?.(!!data.current);
      useNeuroStore.setState({ headlessCsoundRunning: isRunning });
      setSelectedId((prev) => {
        if (prev && nime.some((p) => p.id === prev)) return prev;
        const v12 = nime.find((p) => p.id.includes("MuseV12"));
        return v12?.id ?? nime[0]?.id ?? "";
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [onRunningChange, onPatchSessionChange]);

  React.useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 2500);
    return () => window.clearInterval(id);
  }, [refresh]);

  const selected = patches.find((p) => p.id === selectedId);

  const launchPatch = React.useCallback(
    async (patchId: string, mode: "headless" | "csoundqt") => {
      if (!patchId) return;
      setBusy(true);
      setError(null);
      try {
        await api.launchCsoundPatch({
          library: "nime",
          id: patchId,
          mode,
        });
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const stepPatch = React.useCallback(
    (delta: -1 | 1) => {
      if (patches.length === 0 || stepInFlight.current) return;
      const idx = patches.findIndex((p) => p.id === selectedId);
      const from = idx >= 0 ? idx : 0;
      const next = (from + delta + patches.length) % patches.length;
      const nextId = patches[next]?.id ?? "";
      if (!nextId) return;
      setSelectedId(nextId);
      stepInFlight.current = true;
      void launchPatch(nextId, "headless").finally(() => {
        stepInFlight.current = false;
      });
    },
    [patches, selectedId, launchPatch],
  );

  React.useImperativeHandle(ref, () => ({ stepPatch }), [stepPatch]);

  function launch(mode: "headless" | "csoundqt") {
    void launchPatch(selectedId, mode);
  }

  async function stop() {
    setBusy(true);
    setError(null);
    try {
      await api.stopCsoundPatch();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle
          icon={<Music2 className="h-4 w-4" />}
          description="Prefer Start patch (headless Csound + USB MIDI). CsoundQt is optional. Visualizers run in the browser from live EEG regardless."
          actions={
            <div className="flex flex-wrap gap-1">
              <Badge tone={running ? "emerald" : "neutral"} dot>
                {running ? "Headless Csound" : "Headless off"}
              </Badge>
              {current ? (
                <Badge tone="indigo">Patch linked</Badge>
              ) : null}
            </div>
          }
        >
          NIME Concert Patches
        </CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <ol className="list-decimal list-inside space-y-1.5 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-[11px] leading-5 text-zinc-400">
          <li>
            Connect Muse (or simulator) and confirm <strong className="text-zinc-300">OSC sending</strong> is on
            (Settings, or auto when you start a patch).
          </li>
          <li>
            <strong className="text-emerald-300">Start patch</strong> (recommended) — headless Csound with CoreAudio +
            USB MIDI (<code className="text-zinc-500">-+rtmidi=portmidi</code>). Same musical design without CsoundQt.
          </li>
          <li>
            Optional: <strong className="text-zinc-300">Open in CsoundQt</strong> — same .csd; visuals in the browser
            still run in parallel (see below).
          </li>
          <li>
            <kbd className="rounded border border-zinc-700 bg-zinc-900 px-1 font-mono text-zinc-400">←</kbd> /{" "}
            <kbd className="rounded border border-zinc-700 bg-zinc-900 px-1 font-mono text-zinc-400">→</kbd> on the
            Concert page: previous / next patch and <strong className="text-emerald-300">Start patch</strong> (headless).
          </li>
          <li>
            Use the <strong className="text-zinc-300">Csound console</strong> below (or type on this page) for{" "}
            <code className="text-zinc-500">sensekey</code> — watch <code className="text-zinc-500">printks</code> for band ranges and modes. Browser V12 WASM is separate.
          </li>
        </ol>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1 text-xs text-zinc-400">
            Patch
            <select
              className="nv-select"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              disabled={busy || running}
            >
              {patches.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => void launch("csoundqt")}
              disabled={busy || !selectedId}
              leftIcon={<ExternalLink className="h-4 w-4" />}
            >
              Open in CsoundQt
            </Button>
            <Button
              variant="outline"
              onClick={() => void launch("headless")}
              disabled={busy || running || !selectedId}
              leftIcon={<Play className="h-4 w-4" />}
            >
              Start patch
            </Button>
            <Button
              variant="outline"
              onClick={() => void stop()}
              disabled={busy || !running}
              leftIcon={<Square className="h-4 w-4" />}
            >
              Stop
            </Button>
          </div>
        </div>

        {selected && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-xs leading-5 text-zinc-400">
            <span className="font-mono text-zinc-300">{selected.filename}</span>
            {" · "}
            OSC <span className="font-mono text-emerald-300/90">{selected.oscPort}</span>
            {selected.mindMonitor4Float ? (
              <span className="text-emerald-400/90"> · Mind Monitor ✓</span>
            ) : null}
            {selected.usesMidi !== false ? (
              <span className="text-indigo-300/90"> · USB MIDI (massign)</span>
            ) : null}
            <br />
            NeuroVis OSC → <span className="font-mono text-sky-300/90">{oscTarget}</span>
            {current && (
              <>
                <br />
                Active: <span className="font-mono text-zinc-200">{current}</span>
              </>
            )}
          </div>
        )}

        {error && (
          <p className="text-xs text-rose-300" role="alert">
            {error}
          </p>
        )}

        <p className="text-[11px] leading-5 text-zinc-500">
          Wrong MIDI port? Set{" "}
          <code className="text-zinc-400">NEUROVIS_CSOUND_MIDI_DEVICE=1</code> before starting the server, then
          restart NeuroVis. List devices: <code className="text-zinc-400">csound -U2</code>
        </p>
      </CardBody>
    </Card>
  );
});
