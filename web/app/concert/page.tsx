"use client";

import * as React from "react";
import {
  Eye,
  EyeOff,
  Film,
  Maximize2,
  PanelTop,
  Radio,
  Sparkles,
  Wrench,
} from "lucide-react";
import {
  ConcertVisualizer,
  ALL_CONCERT_SCENES,
  CONCERT_SCENES,
  CONCERT_SHIFT_SCENES,
  CONCERT_BRAIN_ART_SCENES,
  CONCERT_WEBGL_FULLSCREEN_SCENES,
  CONCERT_WEBGL_TF_LACE_SCENES,
  CONCERT_WEBGL_TF_MACRO_SCENES,
  concertSceneSpec,
  type ConcertScene,
} from "@/components/concert/ConcertVisualizer";
import { ConcertCsoundMirrorHud } from "@/components/concert/ConcertCsoundMirrorHud";
import {
  ConcertNimePatchPanel,
  type ConcertNimePatchPanelHandle,
} from "@/components/concert/ConcertNimePatchPanel";
import { ConcertCsoundConsole } from "@/components/concert/ConcertCsoundConsole";
import { ConcertEegStreamStatus } from "@/components/concert/ConcertEegStreamStatus";
import { ConcertGroupPanel } from "@/components/concert/ConcertGroupPanel";
import { ConcertPerformanceRecorderPanel } from "@/components/concert/ConcertPerformanceRecorderPanel";
import { ConcertStageTuningHud } from "@/components/concert/ConcertStageTuningHud";
import { ConcertVisualTuningPanel } from "@/components/concert/ConcertVisualTuningPanel";
import { useCsoundSensekeyForward } from "@/lib/useCsoundSensekey";
import type { ConcertAudioReactiveMode } from "@/lib/concertAudioBlend";
import {
  DEFAULT_CONCERT_VISUAL_TUNING,
  mergeConcertVisualTuning,
  type ConcertVisualTuning,
} from "@/lib/concertVisualTuning";
import { stepConcertScene } from "@/lib/concert/concertSceneNav";
import { stopConcertAudioMeter } from "@/lib/concertAudioMeter";
import { PerformancePresetShareCard } from "@/components/concert/PerformancePresetShareCard";
import { ConcertSceneRotationControls } from "@/components/concert/ConcertSceneRotationControls";
import {
  DEFAULT_CONCERT_SCENE_ROTATION,
  readConcertSceneRotation,
  pickRandomConcertScene,
  writeConcertSceneRotation,
  type ConcertSceneRotationSettings,
} from "@/lib/concert/concertSceneRotation";
import {
  captureConcertPresetSlice,
  type PerformancePresetConcertSlice,
} from "@/lib/performancePreset";
import { CsoundV12Renderer, type V12RenderControls } from "@/components/csound/CsoundV12Renderer";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { useNeuroStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const STAGE_CSOUND_CONTROLS: V12RenderControls = {
  harmonyBand: "alpha",
  bassDriver: "delta",
  melodyDriver: "gamma",
  rhythmDriver: "beta",
  registerDriver: "alpha",
  responseMode: 1,
  orchestration: 1,
  motion: 1,
  palette: 2,
  cc1Mode: "volume",
  melodyVolume: 0.72,
  melodyComplexity: 0.42,
};

function ConcertStage({
  stageRef,
  scene,
  compact,
  tuningHud,
  onCloseTuningHud,
  showHud,
  latestBandsAbs,
  latestBandTraces,
  rollingRaw,
  estimatedEegHz,
  intensity,
  trails,
  simAudioReactive,
  eegReactive,
  arMode,
  visualTuning,
  setTuning,
  setIntensity,
  setTrails,
  setArMode,
  wasmCsoundRunning,
  spec,
  mirrorCsoundHud,
  desktopCsoundRunning,
}: {
  stageRef: React.RefObject<HTMLElement>;
  scene: ConcertScene;
  compact: boolean;
  tuningHud: boolean;
  onCloseTuningHud: () => void;
  showHud: boolean;
  latestBandsAbs: ReturnType<typeof useNeuroStore.getState>["latestBandsAbs"];
  latestBandTraces: ReturnType<typeof useNeuroStore.getState>["latestBandTraces"];
  rollingRaw: ReturnType<typeof useNeuroStore.getState>["rollingRaw"];
  estimatedEegHz: ReturnType<typeof useNeuroStore.getState>["estimatedEegHz"];
  intensity: number;
  trails: number;
  simAudioReactive: boolean;
  eegReactive: boolean;
  arMode: ConcertAudioReactiveMode;
  visualTuning: ConcertVisualTuning;
  setTuning: (p: Partial<ConcertVisualTuning>) => void;
  setIntensity: (v: number) => void;
  setTrails: (v: number) => void;
  setArMode: (m: ConcertAudioReactiveMode) => void;
  wasmCsoundRunning: boolean;
  spec: { title: string; subtitle: string };
  mirrorCsoundHud: boolean;
  desktopCsoundRunning: boolean;
}) {
  return (
    <section
      ref={stageRef}
      className={cn(
        "relative overflow-hidden rounded-3xl border border-zinc-800 bg-black shadow-[0_0_80px_-40px_rgba(34,211,238,.75)]",
        compact && "max-h-[min(42vh,380px)]",
      )}
    >
      <ConcertVisualizer
        scene={scene}
        latestBandsAbs={latestBandsAbs}
        latestBandTraces={latestBandTraces}
        rollingRaw={rollingRaw}
        estimatedEegHz={estimatedEegHz}
        intensity={intensity}
        trails={trails}
        showHud={showHud && !tuningHud}
        simAudioReactive={simAudioReactive}
        eegReactive={eegReactive}
        audioReactiveMode={arMode}
        tuning={visualTuning}
        compact={compact}
      />
      <ConcertCsoundMirrorHud
        enabled={mirrorCsoundHud}
        compact={false}
        running={desktopCsoundRunning}
      />
      <ConcertStageTuningHud
        open={tuningHud}
        onClose={onCloseTuningHud}
        visualTuning={visualTuning}
        onTuningChange={setTuning}
        intensity={intensity}
        onIntensityChange={setIntensity}
        trails={trails}
        onTrailsChange={setTrails}
        arMode={arMode}
        onArModeChange={setArMode}
        eegReactive={eegReactive}
        wasmCsoundRunning={wasmCsoundRunning}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/[0.06] to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/70 to-transparent" />
      {showHud && !tuningHud && (
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex flex-wrap items-end justify-between gap-2">
          <div className="rounded-xl border border-white/10 bg-black/35 px-3 py-2 backdrop-blur-md">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
              {spec.title}
            </div>
            {!compact && (
              <div className="mt-0.5 max-w-xl text-[10px] text-zinc-400">{spec.subtitle}</div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default function ConcertPage() {
  const stageRef = React.useRef<HTMLElement>(null);
  const nimePatchRef = React.useRef<ConcertNimePatchPanelHandle>(null);
  const latestEEG = useNeuroStore((s) => s.latestEEG);
  const latestBandsAbs = useNeuroStore((s) => s.latestBandsAbs);
  const latestBandTraces = useNeuroStore((s) => s.latestBandTraces);
  const rollingRaw = useNeuroStore((s) => s.rollingRaw);
  const estimatedEegHz = useNeuroStore((s) => s.estimatedEegHz);
  const wsStatus = useNeuroStore((s) => s.wsStatus);
  const brainState = useNeuroStore((s) => s.brainState);
  const deviceName = useNeuroStore((s) => s.deviceName);
  const motionStreams = useNeuroStore((s) => s.motion);
  const batteryPct = useNeuroStore((s) => s.batteryPct);
  const bandEdgePreset = useNeuroStore((s) => s.bandEdgePreset);
  const simulatorMode = useNeuroStore((s) => Boolean(s.settings.simulatorMode));
  const clientSimRunning = useNeuroStore((s) => s.clientSim.running);
  const dualOn = useNeuroStore((s) => s.dualRehearsal.enabled);
  const simAudioReactive = simulatorMode || clientSimRunning || dualOn;
  const [desktopCsoundRunning, setDesktopCsoundRunning] = React.useState(false);
  const [nimePatchSession, setNimePatchSession] = React.useState(false);
  const liveEeg = wsStatus === "open";
  /** Live WebSocket EEG drives AR band envelope (no patch required). */
  const eegReactive = simAudioReactive || liveEeg;

  const [scene, setScene] = React.useState<ConcertScene>("auroraBrain");
  const [intensity, setIntensity] = React.useState(1.15);
  const [trails, setTrails] = React.useState(0.9);
  const [showHud, setShowHud] = React.useState(true);
  const [showControls, setShowControls] = React.useState(true);
  const [tuningMode, setTuningMode] = React.useState(true);
  const [tuningHud, setTuningHud] = React.useState(false);
  const [mirrorCsoundHud, setMirrorCsoundHud] = React.useState(true);
  const [csoundControls, setCsoundControls] =
    React.useState<V12RenderControls>(STAGE_CSOUND_CONTROLS);
  const [arMode, setArMode] = React.useState<ConcertAudioReactiveMode>("blend");
  const [visualTuning, setVisualTuning] = React.useState<ConcertVisualTuning>(
    DEFAULT_CONCERT_VISUAL_TUNING,
  );
  const [sceneRotation, setSceneRotation] = React.useState<ConcertSceneRotationSettings>(
    DEFAULT_CONCERT_SCENE_ROTATION,
  );
  const [visualQueue, setVisualQueue] = React.useState<ConcertScene[]>([]);
  const [patchQueue, setPatchQueue] = React.useState<string[]>([]);
  const [showActive, setShowActive] = React.useState(false);
  const [visualQueueIndex, setVisualQueueIndex] = React.useState(0);
  const [patchQueueIndex, setPatchQueueIndex] = React.useState(0);
  const [visualDwell, setVisualDwell] = React.useState(0);
  const [patchDwell, setPatchDwell] = React.useState(0);

  React.useEffect(() => {
    setSceneRotation(readConcertSceneRotation());
  }, []);
  const [wasmCsoundRunning, setWasmCsoundRunning] = React.useState(false);

  const showRef = React.useRef({
    showActive: false,
    visualQueue: [] as ConcertScene[],
    patchQueue: [] as string[],
    visualQueueIndex: 0,
    patchQueueIndex: 0,
  });
  showRef.current = { showActive, visualQueue, patchQueue, visualQueueIndex, patchQueueIndex };

  const stepVisualInQueue = React.useCallback((delta: -1 | 1) => {
    const { showActive: on, visualQueue: vq, visualQueueIndex: qi } = showRef.current;
    if (on) {
      if (vq.length === 0) return;
      const next = (qi + delta + vq.length) % vq.length;
      setVisualQueueIndex(next);
      setScene(vq[next]!);
      return;
    }
    setScene((current) => stepConcertScene(current, delta));
  }, []);

  const stepPatchInQueue = React.useCallback((delta: -1 | 1) => {
    const { showActive: on, patchQueue: pq, patchQueueIndex: pi } = showRef.current;
    if (on) {
      if (pq.length === 0) return;
      const next = (pi + delta + pq.length) % pq.length;
      setPatchQueueIndex(next);
      void nimePatchRef.current?.launchPatchId(pq[next]!);
      nimePatchRef.current?.setSelectedId(pq[next]!);
      return;
    }
    nimePatchRef.current?.stepPatch(delta);
  }, []);

  const updateSceneRotation = React.useCallback((next: ConcertSceneRotationSettings) => {
    setSceneRotation(next);
    writeConcertSceneRotation(next);
  }, []);
  const wasmMeterOn = arMode === "wasm" || arMode === "blend";

  const setTuning = (patch: Partial<ConcertVisualTuning>) =>
    setVisualTuning((t) => mergeConcertVisualTuning({ ...t, ...patch }));

  React.useEffect(() => {
    return () => stopConcertAudioMeter();
  }, []);

  React.useEffect(() => {
    if (!sceneRotation.enabled || showActive) return;
    const ms = sceneRotation.intervalSeconds * 1000;
    const id = window.setInterval(() => {
      setScene((current) => pickRandomConcertScene(current));
    }, ms);
    return () => window.clearInterval(id);
  }, [sceneRotation.enabled, sceneRotation.intervalSeconds, showActive]);

  React.useEffect(() => {
    if (!showActive) return;
    const timers: number[] = [];
    if (visualDwell > 0 && visualQueue.length > 1) {
      timers.push(
        window.setInterval(() => stepVisualInQueue(1), visualDwell * 1000) as number,
      );
    }
    if (patchDwell > 0 && patchQueue.length > 1) {
      timers.push(
        window.setInterval(() => stepPatchInQueue(1), patchDwell * 1000) as number,
      );
    }
    return () => timers.forEach((id) => window.clearInterval(id));
  }, [showActive, visualDwell, patchDwell, visualQueue.length, patchQueue.length, stepVisualInQueue, stepPatchInQueue]);

  const playShow = React.useCallback(() => {
    if (sceneRotation.enabled) {
      updateSceneRotation({ ...sceneRotation, enabled: false });
    }
    setShowActive(true);
    if (visualQueue.length > 0) {
      setVisualQueueIndex(0);
      setScene(visualQueue[0]!);
    }
    if (patchQueue.length > 0) {
      setPatchQueueIndex(0);
      nimePatchRef.current?.setSelectedId(patchQueue[0]!);
      void nimePatchRef.current?.launchPatchId(patchQueue[0]!);
    }
  }, [sceneRotation, updateSceneRotation, visualQueue, patchQueue]);

  const stopShow = React.useCallback(() => {
    setShowActive(false);
  }, []);

  useCsoundSensekeyForward(desktopCsoundRunning && !tuningMode);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) {
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        stepVisualInQueue(-1);
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        stepVisualInQueue(1);
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        stepPatchInQueue(-1);
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        stepPatchInQueue(1);
        return;
      }
      if (event.key === "f" || event.key === "F") {
        void requestStageFullscreen(stageRef.current);
      }
      if (event.key === "h" || event.key === "H") setShowHud((v) => !v);
      if (event.key === "c" || event.key === "C") setShowControls((v) => !v);
      if (event.key === "t" || event.key === "T") setTuningMode((v) => !v);
      if (event.key === "u" || event.key === "U") setTuningHud((v) => !v);
      if (event.key === "m" || event.key === "M") setMirrorCsoundHud((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stepVisualInQueue, stepPatchInQueue]);

  const spec = concertSceneSpec(scene) ?? ALL_CONCERT_SCENES[0];

  const captureConcert = React.useCallback(
    () =>
      captureConcertPresetSlice({
        scene,
        intensity,
        trails,
        showHud,
        showControls,
        tuning: visualTuning,
        arMode,
        tuningMode,
        tuningHud,
        mirrorCsoundHud,
        sceneRotation,
      }),
    [
      scene,
      intensity,
      trails,
      showHud,
      showControls,
      visualTuning,
      arMode,
      tuningMode,
      tuningHud,
      mirrorCsoundHud,
      sceneRotation,
    ],
  );

  const applyConcertSlice = React.useCallback((c: PerformancePresetConcertSlice) => {
    setScene(concertSceneSpec(c.scene) ? c.scene : "auroraBrain");
    setIntensity(c.intensity);
    setTrails(c.trails);
    setShowHud(c.showHud);
    setShowControls(c.showControls);
    setVisualTuning(mergeConcertVisualTuning(c.tuning));
    setArMode(c.arMode);
    setTuningMode(c.tuningMode);
    setTuningHud(c.tuningHud);
    setMirrorCsoundHud(c.mirrorCsoundHud);
    if (c.sceneRotation) {
      updateSceneRotation(c.sceneRotation);
    }
  }, [updateSceneRotation]);

  const stageProps = {
    stageRef,
    scene,
    showHud,
    latestBandsAbs,
    latestBandTraces,
    rollingRaw,
    estimatedEegHz,
    intensity,
    trails,
    simAudioReactive,
    eegReactive,
    arMode,
    visualTuning,
    setTuning,
    setIntensity,
    setTrails,
    setArMode,
    wasmCsoundRunning,
    spec,
    mirrorCsoundHud,
    desktopCsoundRunning,
  };

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/95 px-3 py-2 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={tuningMode ? "primary" : "outline"}
            size="sm"
            leftIcon={<Wrench className="h-4 w-4" />}
            onClick={() => setTuningMode((v) => !v)}
          >
            {tuningMode ? "Tuning mode" : "Performance layout"}
          </Button>
          {tuningMode && (
            <Button
              variant={tuningHud ? "primary" : "outline"}
              size="sm"
              leftIcon={<PanelTop className="h-4 w-4" />}
              onClick={() => setTuningHud((v) => !v)}
            >
              {tuningHud ? "HUD on stage" : "HUD under stage"}
            </Button>
          )}
          <Button
            variant={mirrorCsoundHud ? "primary" : "outline"}
            size="sm"
            leftIcon={<Radio className="h-4 w-4" />}
            onClick={() => setMirrorCsoundHud((v) => !v)}
          >
            {mirrorCsoundHud ? "Csound mirror" : "Mirror off"}
          </Button>
          <Badge tone={wsStatus === "open" ? "emerald" : "rose"} dot>
            {wsStatus === "open" ? "WS open" : wsStatus}
          </Badge>
          {brainState && <Badge tone="violet">{brainState.state}</Badge>}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHud((v) => !v)}
            leftIcon={showHud ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          >
            HUD
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void requestStageFullscreen(stageRef.current)}
            leftIcon={<Maximize2 className="h-4 w-4" />}
          >
            Fullscreen
          </Button>
        </div>
        <p className="text-[10px] text-zinc-600">
          <kbd className="text-zinc-500">↑↓</kbd> visual queue · <kbd className="text-zinc-500">←→</kbd> patch queue
          {showActive ? " (show)" : ""}
          · <kbd className="text-zinc-500">T</kbd> tuning · <kbd className="text-zinc-500">U</kbd> stage HUD ·{" "}
          <kbd className="text-zinc-500">H</kbd> overlay · <kbd className="text-zinc-500">M</kbd> Csound mirror
        </p>
      </div>

      <PerformancePresetShareCard
        capture={() => ({
          v12: csoundControls,
          concert: captureConcert(),
          research: { bandEdgePreset },
        })}
        onApply={(p) => {
          setCsoundControls(p.v12);
          if (p.concert) applyConcertSlice(p.concert);
        }}
      />

      <ConcertEegStreamStatus />

      <ConcertPerformanceRecorderPanel stageRef={stageRef} />

      <ConcertGroupPanel
        scene={scene}
        onSceneChange={setScene}
        visualQueue={visualQueue}
        onVisualQueueChange={setVisualQueue}
        patchQueue={patchQueue}
        onPatchQueueChange={setPatchQueue}
        showActive={showActive}
        visualQueueIndex={visualQueueIndex}
        patchQueueIndex={patchQueueIndex}
        visualDwell={visualDwell}
        onVisualDwellChange={setVisualDwell}
        patchDwell={patchDwell}
        onPatchDwellChange={setPatchDwell}
        onPlayShow={playShow}
        onStopShow={stopShow}
        onStepVisualQueue={stepVisualInQueue}
        onStepPatchQueue={stepPatchInQueue}
        nimeRef={nimePatchRef}
      />

      {tuningMode ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle
                icon={<Film className="h-4 w-4" />}
                description="All 20 scenes use EEG bands + audio drive — tune with sliders below."
              >
                Tuning — scene
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              <label className="flex flex-col gap-1 text-xs text-zinc-400">
                Visualization
                <select
                  className="nv-select"
                  value={scene}
                  onChange={(e) => setScene(e.target.value as ConcertScene)}
                >
                  {ALL_CONCERT_SCENES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </label>
              <ConcertSceneRotationControls settings={sceneRotation} onChange={updateSceneRotation} />
            </CardBody>
          </Card>

          <ConcertStage {...stageProps} compact tuningHud={tuningHud} onCloseTuningHud={() => setTuningHud(false)} />

          {!tuningHud && (
            <Card>
              <CardHeader>
                <CardTitle icon={<Wrench className="h-4 w-4" />}>Tuning — levels</CardTitle>
              </CardHeader>
              <CardBody>
                <ConcertVisualTuningPanel
                  visualTuning={visualTuning}
                  onTuningChange={setTuning}
                  intensity={intensity}
                  onIntensityChange={setIntensity}
                  trails={trails}
                  onTrailsChange={setTrails}
                  arMode={arMode}
                  onArModeChange={setArMode}
                  eegReactive={eegReactive}
                  wasmCsoundRunning={wasmCsoundRunning}
                />
              </CardBody>
            </Card>
          )}
        </>
      ) : (
        <>
          <Card className={cn(!showControls && "hidden")}>
            <CardHeader>
              <CardTitle
                icon={<Film className="h-4 w-4" />}
                description="All scenes: EEG band colors + audio drive. Tuning mode for level sliders beside a small preview."
                actions={
                  deviceName ? <Badge tone="indigo">{deviceName}</Badge> : null
                }
              >
                Concert Visualizations
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-8">
              <ConcertSceneRotationControls settings={sceneRotation} onChange={updateSceneRotation} />
              {(
                [
                  { label: "Classic", scenes: CONCERT_SCENES },
                  { label: "Pulse & lattice", scenes: CONCERT_SHIFT_SCENES },
                  { label: "Neural art", scenes: CONCERT_BRAIN_ART_SCENES },
                  { label: "WebGL · fullscreen", scenes: CONCERT_WEBGL_FULLSCREEN_SCENES },
                  { label: "WebGL · TF neuro lace", scenes: CONCERT_WEBGL_TF_LACE_SCENES },
                  { label: "WebGL · TF macro", scenes: CONCERT_WEBGL_TF_MACRO_SCENES },
                ] as const
              ).map((group) => (
                <div key={group.label} className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    {group.label}
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                    {group.scenes.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setScene(item.id)}
                        className={cn(
                          "rounded-xl border p-4 text-left transition",
                          scene === item.id
                            ? "border-emerald-400/80 bg-emerald-500/10 shadow-[0_0_28px_-14px_rgba(16,185,129,.9)]"
                            : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-600",
                        )}
                      >
                        <div className="text-sm font-semibold text-zinc-100">{item.title}</div>
                        <p className="mt-2 text-xs leading-5 text-zinc-500">{item.subtitle}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>

          <ConcertStage
            {...stageProps}
            compact={false}
            tuningHud={false}
            onCloseTuningHud={() => {}}
          />
        </>
      )}

      <ConcertNimePatchPanel
        ref={nimePatchRef}
        onRunningChange={setDesktopCsoundRunning}
        onPatchSessionChange={setNimePatchSession}
      />

      <ConcertCsoundConsole running={desktopCsoundRunning} />

      <Card className={cn(!showControls && "hidden")}>
        <CardHeader>
          <CardTitle icon={<Sparkles className="h-4 w-4" />}>V12 Audio For Concert Mode</CardTitle>
        </CardHeader>
        <CardBody>
          <CsoundV12Renderer
            controls={csoundControls}
            latestEEG={latestEEG}
            latestBandsAbs={latestBandsAbs}
            latestBandTraces={latestBandTraces}
            motion={motionStreams}
            batteryPct={batteryPct}
            enableConcertWasmMeter={wasmMeterOn}
            onStatusChange={(s) => setWasmCsoundRunning(s === "running")}
          />
        </CardBody>
      </Card>
    </div>
  );
}

async function requestStageFullscreen(element: HTMLElement | null) {
  if (!element) return;
  if (document.fullscreenElement) {
    await document.exitFullscreen();
    return;
  }
  await element.requestFullscreen();
}
