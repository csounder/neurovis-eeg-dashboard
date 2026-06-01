"use client";

import * as React from "react";
import { getConcertAudioLevel } from "@/lib/concertAudioMeter";
import { blendConcertAudioLevel, type ConcertAudioReactiveMode } from "@/lib/concertAudioBlend";
import { DEFAULT_CONCERT_VISUAL_TUNING, type ConcertVisualTuning } from "@/lib/concertVisualTuning";
import type { BandName, BandPowers } from "@/lib/types";
import { computeConcertSpectrum } from "@/lib/concert/concertDataScenes";
import {
  CONCERT_WEBGL_SCENES,
  fragmentForScene,
  isTfWebglScene,
  tfPresetForScene,
  WEBGL_SCENE_IDS,
  WEBGL_VERTEX,
  type ConcertWebglSceneId,
} from "@/lib/concert/webgl/concertWebglScenes";
import {
  isTfMacroScene,
  TF_LACE_LINE_BOOST,
  TF_LACE_POINT_BOOST,
  TF_MACRO_LINE_BOOST,
  TF_MACRO_POINT_BOOST,
  type TfPreset,
} from "@/lib/concert/webgl/concertWebglTfPresets";
import {
  bindTfParticleTbo,
  bindTfUpdateUniforms,
  createTfParticles,
  makeTfLineProgram,
  makeTfRenderProgram,
  makeTfUpdateProgram,
  supportsTextureBuffer,
  type TfParticles,
  tfDrawVao,
  tfDstBuf,
  tfLineVertexCount,
  tfSrcVao,
  tfSwap,
} from "@/lib/concert/webgl/concertWebglTransformFeedback";
import {
  createWebGL2Context,
  probeWebGL2,
  webglFailureHint,
} from "@/lib/concert/webgl/webglSupport";
import {
  getUniforms,
  linkProgram,
  makeFloatTexture1D,
  makePingPong,
  resizePingPong,
  updateFloatTexture1D,
} from "@/lib/concert/webgl/webglKit";

type BandVector = Record<BandName, number>;
const BAND_ORDER: BandName[] = ["delta", "theta", "alpha", "beta", "gamma"];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeBands(abs: BandPowers | null): BandVector {
  const fallback: BandVector = {
    delta: 0.35,
    theta: 0.42,
    alpha: 0.55,
    beta: 0.38,
    gamma: 0.26,
  };
  if (!abs) return fallback;
  return BAND_ORDER.reduce((acc, band) => {
    const value = abs[band];
    acc[band] = Number.isFinite(value) ? clamp((value + 2.5) / 4, 0, 1) : fallback[band];
    return acc;
  }, {} as BandVector);
}

function channelEnergy(traces: Record<BandName, number[]> | null) {
  const out = [0.25, 0.25, 0.25, 0.25];
  if (!traces) return out;
  for (let ch = 0; ch < 4; ch += 1) {
    let sum = 0;
    for (const band of BAND_ORDER) sum += Math.abs(traces[band]?.[ch] ?? 0);
    out[ch] = clamp(sum / 120, 0, 1);
  }
  return out;
}

function applyEegVisualTuning(
  bands: BandVector,
  channels: number[],
  tuning: ConcertVisualTuning,
  intensity: number,
) {
  const neutral = normalizeBands(null);
  const influence = tuning.eegInfluence;
  const sens = tuning.eegSensitivity;
  const scaledBands = BAND_ORDER.reduce((acc, band) => {
    const live = bands[band];
    const blended = neutral[band] * (1 - influence) + live * influence;
    acc[band] = clamp(blended * sens, 0, 1);
    return acc;
  }, {} as BandVector);
  const scaledChannels = channels.map((c) => clamp((0.25 * (1 - influence) + c * influence) * sens, 0, 1));
  return {
    bands: scaledBands,
    channels: scaledChannels,
    drawIntensity: intensity * tuning.visualScale * tuning.brightness,
  };
}

export function ConcertVisualizerWebGL({
  scene,
  latestBandsAbs,
  latestBandTraces,
  intensity = 1,
  trails = 0.86,
  showHud = true,
  simAudioReactive = false,
  eegReactive = false,
  audioReactiveMode = "blend",
  tuning = DEFAULT_CONCERT_VISUAL_TUNING,
  compact = false,
  rollingRaw = null,
  estimatedEegHz = null,
}: {
  scene: ConcertWebglSceneId;
  latestBandsAbs: BandPowers | null;
  latestBandTraces: Record<BandName, number[]> | null;
  intensity?: number;
  trails?: number;
  showHud?: boolean;
  simAudioReactive?: boolean;
  eegReactive?: boolean;
  audioReactiveMode?: ConcertAudioReactiveMode;
  tuning?: ConcertVisualTuning;
  compact?: boolean;
  rollingRaw?: number[][] | null;
  estimatedEegHz?: number | null;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [webglInfo, setWebglInfo] = React.useState<string | null>(null);

  React.useEffect(() => {
    const probe = probeWebGL2();
    if (probe.isSoftwareRenderer && probe.renderer) {
      setWebglInfo(`Software WebGL (${probe.renderer}). Scenes should run; enable GPU acceleration for better performance.`);
    }
  }, []);

  const dataRef = React.useRef({
    scene,
    latestBandsAbs,
    latestBandTraces,
    intensity,
    trails,
    showHud,
    simAudioReactive,
    eegReactive,
    audioReactiveMode,
    tuning,
    rollingRaw,
    estimatedEegHz,
  });

  React.useEffect(() => {
    dataRef.current = {
      scene,
      latestBandsAbs,
      latestBandTraces,
      intensity,
      trails,
      showHud,
      simAudioReactive,
      eegReactive,
      audioReactiveMode,
      tuning,
      rollingRaw,
      estimatedEegHz,
    };
  }, [
    scene,
    latestBandsAbs,
    latestBandTraces,
    intensity,
    trails,
    showHud,
    simAudioReactive,
    eegReactive,
    audioReactiveMode,
    tuning,
    rollingRaw,
    estimatedEegHz,
  ]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = createWebGL2Context(canvas);
    if (!gl) {
      const probe = probeWebGL2();
      setError(probe.ok ? "WebGL2 context could not be created on this canvas." : probe.message);
      return;
    }
    const gl2: WebGL2RenderingContext = gl;

    // Core GL state
    gl2.disable(gl2.DEPTH_TEST);
    gl2.disable(gl2.CULL_FACE);
    gl2.blendFunc(gl2.ONE, gl2.ONE_MINUS_SRC_ALPHA);
    // WebGL2 requires a VAO bound for gl_VertexID fullscreen triangle.
    const vao = gl2.createVertexArray();
    if (!vao) {
      setError("WebGL: createVertexArray failed.");
      return;
    }
    gl2.bindVertexArray(vao);

    const dpr = () => Math.min(window.devicePixelRatio || 1, 2.5);
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr()));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr()));
      gl2.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    // Float FFT texture
    const FFT_W = 128;
    let fftTex: WebGLTexture | null = null;
    try {
      fftTex = makeFloatTexture1D(gl2, FFT_W);
    } catch (e) {
      setError(String(e));
      return () => {};
    }
    const fftRgba = new Float32Array(FFT_W * 4);

    // Feedback pingpong
    let fb;
    try {
      fb = makePingPong(gl2, canvas.width, canvas.height);
    } catch (e) {
      setError(String(e));
      return;
    }
    // Clear both buffers once (avoid undefined contents feeding back).
    gl2.bindFramebuffer(gl2.FRAMEBUFFER, fb.aFbo);
    gl2.clearColor(0, 0, 0, 1);
    gl2.clear(gl2.COLOR_BUFFER_BIT);
    gl2.bindFramebuffer(gl2.FRAMEBUFFER, fb.bFbo);
    gl2.clear(gl2.COLOR_BUFFER_BIT);
    gl2.bindFramebuffer(gl2.FRAMEBUFFER, null);

    const PRESENT_FS = `#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec2 uRes;
uniform sampler2D uTex;
uniform float uGain;
vec3 aces(vec3 x) {
  x = max(x, 0.0);
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
void main(){
  vec2 uv = gl_FragCoord.xy / max(uRes, vec2(1.0));
  vec3 col = texture(uTex, uv).rgb * uGain;
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col += col * smoothstep(0.45, 1.0, lum) * 0.08;
  vec2 q = uv * 2.0 - 1.0;
  q.x *= uRes.x / max(1.0, uRes.y);
  col *= 1.0 - 0.12 * dot(q, q);
  fragColor = vec4(aces(col), 1.0);
}`;
    const presentBundle = linkProgram(gl2, WEBGL_VERTEX, PRESENT_FS);
    const presentUniforms = getUniforms(gl2, presentBundle.program, ["uRes", "uTex", "uGain"]);

    // Program cache per scene
    const programs = new Map<string, { program: WebGLProgram; uniforms: ReturnType<typeof getUniforms> }>();
    const uniformNames = ["uRes", "uTime", "uAudio", "uTrails", "uBands", "uBands2", "uChannels", "uFftTex", "uPrev"];

    function getProgram(sceneId: ConcertWebglSceneId) {
      const key = sceneId;
      const cached = programs.get(key);
      if (cached) return cached;
      const frag = fragmentForScene(sceneId);
      const bundle = linkProgram(gl2, WEBGL_VERTEX, frag);
      const uniforms = getUniforms(gl2, bundle.program, uniformNames);
      const next = { program: bundle.program, uniforms };
      programs.set(key, next);
      return next;
    }

    type TfGpuOk = {
      presetId: string;
      particles: TfParticles;
      update: ReturnType<typeof makeTfUpdateProgram>;
      render: ReturnType<typeof makeTfRenderProgram>;
      lines: ReturnType<typeof makeTfLineProgram> | null;
      linesOk: boolean;
      lineSlots: number;
      prevSynapseDrive: number;
    };

    let tfGpu: TfGpuOk | null = null;
    let tfUpdate: ReturnType<typeof makeTfUpdateProgram> | null = null;
    let tfRender: ReturnType<typeof makeTfRenderProgram> | null = null;
    let tfProgramsFailed = false;
    let errorCleared = false;
    let activeScene: ConcertWebglSceneId | null = null;
    let raf = 0;
    let destroyed = false;

    const reportError = (msg: string) => {
      errorCleared = false;
      setError(msg);
    };
    const markOk = () => {
      if (!errorCleared) {
        errorCleared = true;
        setError(null);
      }
    };

    const ensureTfPrograms = (): {
      update: ReturnType<typeof makeTfUpdateProgram>;
      render: ReturnType<typeof makeTfRenderProgram>;
    } | null => {
      if (tfProgramsFailed) return null;
      try {
        if (!tfUpdate) tfUpdate = makeTfUpdateProgram(gl2);
        if (!tfRender) tfRender = makeTfRenderProgram(gl2);
        if (!tfUpdate || !tfRender) return null;
        return { update: tfUpdate, render: tfRender };
      } catch (e) {
        tfProgramsFailed = true;
        reportError(String(e));
        return null;
      }
    };

    const disposeTfGpu = (gpu: TfGpuOk | null) => {
      if (!gpu) return;
      gl2.deleteBuffer(gpu.particles.srcBuf);
      gl2.deleteBuffer(gpu.particles.dstBuf);
      gl2.deleteVertexArray(gpu.particles.srcVao);
      gl2.deleteVertexArray(gpu.particles.dstVao);
      gl2.deleteTransformFeedback(gpu.particles.tf);
      gl2.deleteTexture(gpu.particles.tboTex);
      if (gpu.lines) gl2.deleteProgram(gpu.lines.program);
    };

    const ensureTf = (preset: TfPreset): TfGpuOk | null => {
      if (tfProgramsFailed) return null;
      if (tfGpu && tfGpu.presetId === preset.id) return tfGpu;
      disposeTfGpu(tfGpu);
      tfGpu = null;
      try {
        const programs = ensureTfPrograms();
        if (!programs) return null;
        const { update, render } = programs;
        const linesOk = supportsTextureBuffer(gl2);
        const lines = linesOk ? makeTfLineProgram(gl2, preset) : null;
        tfGpu = {
          presetId: preset.id,
          particles: createTfParticles(gl2, preset),
          update,
          render,
          lines,
          linesOk,
          lineSlots: preset.lineSlots,
          prevSynapseDrive: 0,
        };
        return tfGpu;
      } catch (e) {
        tfGpu = null;
        reportError(String(e));
        return null;
      }
    };

    const renderTfScene = (
      preset: TfPreset,
      bands: BandVector,
      channels: number[],
      drive: number,
      motionNow: number,
      motionScale: number,
      glFlow: number,
      glGlow: number,
      glBright: number,
    ): boolean => {
      const tf = ensureTf(preset);
      if (!tf?.update?.program || !tf.render?.program) return false;
      const { particles, update, render: tfRenderProg, lines, linesOk, lineSlots } = tf;
      const synapseDrive = clamp(bands.gamma * 0.75 + drive * 0.55 + bands.beta * 0.25, 0, 1);
      const synapseFlash = clamp(synapseDrive - tf.prevSynapseDrive * 0.82, 0, 1);
      tf.prevSynapseDrive = synapseDrive;

      gl2.clearColor(0.028, 0.04, 0.075, 1);
      gl2.clear(gl2.COLOR_BUFFER_BIT);

      gl2.useProgram(update.program);
      bindTfUpdateUniforms(
        gl2,
        update.uniforms,
        preset,
        {
          time: motionNow,
          dt: 1 / 60,
          audio: drive,
          synapseDrive,
          bands,
          channels,
          count: particles.count,
        },
        { flow: glFlow, dt: motionScale },
      );
      gl2.bindVertexArray(tfSrcVao(particles));
      gl2.bindTransformFeedback(gl2.TRANSFORM_FEEDBACK, particles.tf);
      gl2.bindBufferBase(gl2.TRANSFORM_FEEDBACK_BUFFER, 0, tfDstBuf(particles));
      gl2.enable(gl2.RASTERIZER_DISCARD);
      gl2.beginTransformFeedback(gl2.POINTS);
      gl2.drawArrays(gl2.POINTS, 0, particles.count);
      gl2.endTransformFeedback();
      gl2.disable(gl2.RASTERIZER_DISCARD);
      gl2.bindTransformFeedback(gl2.TRANSFORM_FEEDBACK, null);
      gl2.bindBufferBase(gl2.TRANSFORM_FEEDBACK_BUFFER, 0, null);
      gl2.bindVertexArray(null);
      tfSwap(particles);

      gl2.enable(gl2.BLEND);
      gl2.blendFunc(gl2.SRC_ALPHA, gl2.ONE);

      if (linesOk && lines && bindTfParticleTbo(gl2, particles, 0)) {
        gl2.useProgram(lines.program);
        gl2.uniform2f(lines.uniforms.uRes, canvas.width, canvas.height);
        gl2.uniform1i(lines.uniforms.uCount, particles.count);
        gl2.uniform1i(lines.uniforms.uLineSlots, lineSlots);
        gl2.uniform1i(lines.uniforms.uParticles, 0);
        gl2.uniform1f(lines.uniforms.uAudio, drive);
        gl2.uniform1f(lines.uniforms.uSynapseFlash, synapseFlash);
        gl2.uniform1f(
          lines.uniforms.uLineGain,
          preset.lineGain *
            (isTfMacroScene(preset.id) ? TF_MACRO_LINE_BOOST : TF_LACE_LINE_BOOST) *
            glGlow *
            glBright,
        );
        gl2.drawArrays(gl2.LINES, 0, tfLineVertexCount(particles.count, lineSlots));
      }

      gl2.useProgram(tfRenderProg.program);
      gl2.uniform2f(tfRenderProg.uniforms.uRes, canvas.width, canvas.height);
      gl2.uniform1f(tfRenderProg.uniforms.uAudio, drive);
      gl2.uniform1f(tfRenderProg.uniforms.uSynapseFlash, synapseFlash);
      gl2.uniform1f(
        tfRenderProg.uniforms.uPointGain,
        preset.pointGain *
          (isTfMacroScene(preset.id) ? TF_MACRO_POINT_BOOST : TF_LACE_POINT_BOOST) *
          glGlow *
          glBright,
      );
      gl2.uniform4f(tfRenderProg.uniforms.uBands, bands.delta, bands.theta, bands.alpha, bands.beta);
      gl2.uniform4f(tfRenderProg.uniforms.uBands2, bands.gamma, 0, 0, 0);
      gl2.bindVertexArray(tfDrawVao(particles));
      gl2.drawArrays(gl2.POINTS, 0, particles.count);
      gl2.bindVertexArray(null);
      return true;
    };

    const render = (timeMs: number) => {
      if (destroyed) return;
      const now = timeMs / 1000;
      const data = dataRef.current;
      if (!WEBGL_SCENE_IDS.has(data.scene)) return;

      if (data.scene !== activeScene) {
        activeScene = data.scene;
        errorCleared = false;
        setError(null);
        if (!isTfWebglScene(data.scene)) tfProgramsFailed = false;
        if (tfGpu) {
          const nextPreset = tfPresetForScene(data.scene);
          if (!nextPreset || tfGpu.presetId !== nextPreset.id) {
            disposeTfGpu(tfGpu);
            tfGpu = null;
          }
        }
      }

      if (fb.w !== canvas.width || fb.h !== canvas.height) {
        resizePingPong(gl2, fb, canvas.width, canvas.height);
      }

      const rawBands = normalizeBands(data.latestBandsAbs);
      const rawChannels = channelEnergy(data.latestBandTraces);
      const { bands, channels, drawIntensity } = applyEegVisualTuning(rawBands, rawChannels, data.tuning, data.intensity);

      const audio = blendConcertAudioLevel(
        getConcertAudioLevel(),
        bands,
        channels,
        now,
        data.audioReactiveMode,
        data.simAudioReactive || data.eegReactive,
        data.tuning.arAudioMix,
      );

      const motionActivity = data.tuning.motionActivity;
      const glMotion = data.tuning.glMotion;
      const glBright = data.tuning.glBrightness;
      const glGlow = data.tuning.glParticleGlow;
      const motionNow = now * motionActivity;
      const motionScale = motionActivity * glMotion;

      // Spectrum → float texture (x: 0..50 Hz)
      const sr = data.estimatedEegHz && data.estimatedEegHz > 0 ? data.estimatedEegHz : 256;
      const spectrum = computeConcertSpectrum(data.rollingRaw, sr, 0);
      for (let i = 0; i < FFT_W; i += 1) {
        const x01 = i / (FFT_W - 1);
        let v = 0;
        if (spectrum) {
          // spectrum.psdDb is dB; map similarly to other pages
          const idx = Math.floor(x01 * (spectrum.psdDb.length - 1));
          const db = spectrum.psdDb[idx] ?? -80;
          v = clamp((db + 55) / 45, 0, 1);
        }
        fftRgba[i * 4 + 0] = v;
        fftRgba[i * 4 + 1] = v * v;
        fftRgba[i * 4 + 2] = Math.sqrt(v);
        fftRgba[i * 4 + 3] = 1;
      }
      updateFloatTexture1D(gl2, fftTex, FFT_W, fftRgba);

      if (isTfWebglScene(data.scene)) {
        const preset = tfPresetForScene(data.scene);
        if (
          preset &&
          renderTfScene(
            preset,
            bands,
            channels,
            clamp(audio, 0, 1),
            motionNow,
            motionScale,
            glMotion,
            glGlow,
            glBright,
          )
        ) {
          markOk();
        }
        if (!destroyed) raf = requestAnimationFrame(render);
        return;
      }

      let programBundle;
      try {
        programBundle = getProgram(data.scene);
      } catch (e) {
        reportError(String(e));
        if (!destroyed) raf = requestAnimationFrame(render);
        return;
      }
      const { program, uniforms } = programBundle;
      gl2.useProgram(program);

      gl2.uniform2f(uniforms.uRes, canvas.width, canvas.height);
      gl2.uniform1f(uniforms.uTime, motionNow * glMotion * (0.35 + audio * 0.2));
      // Keep shader drive in a stable 0..1-ish range (avoid blown-out / zoomy looks).
      gl2.uniform1f(uniforms.uAudio, clamp(audio, 0, 1));
      // Only scenes that explicitly use feedback should get trails. Otherwise it reads as blur/flicker.
      const wantsFeedback = data.scene === "glCurlNoiseParticles";
      gl2.uniform1f(uniforms.uTrails, wantsFeedback ? clamp(data.trails, 0, 0.98) : 0);
      gl2.uniform4f(uniforms.uBands, bands.delta, bands.theta, bands.alpha, bands.beta);
      gl2.uniform4f(uniforms.uBands2, bands.gamma, 0, 0, 0);
      gl2.uniform4f(uniforms.uChannels, channels[0] ?? 0, channels[1] ?? 0, channels[2] ?? 0, channels[3] ?? 0);

      gl2.activeTexture(gl2.TEXTURE0);
      gl2.bindTexture(gl2.TEXTURE_2D, fftTex);
      gl2.uniform1i(uniforms.uFftTex, 0);

      gl2.activeTexture(gl2.TEXTURE1);
      gl2.bindTexture(gl2.TEXTURE_2D, fb.readTex());
      gl2.uniform1i(uniforms.uPrev, 1);

      // render to pingpong
      gl2.bindFramebuffer(gl2.FRAMEBUFFER, fb.writeFbo());
      gl2.drawArrays(gl2.TRIANGLES, 0, 3);
      gl2.bindFramebuffer(gl2.FRAMEBUFFER, null);

      // swap so readTex becomes the freshly rendered frame
      fb.swap();

      // present (no feedback mix)
      gl2.useProgram(presentBundle.program);
      gl2.uniform2f(presentUniforms.uRes, canvas.width, canvas.height);
      gl2.uniform1f(presentUniforms.uGain, glBright);
      gl2.activeTexture(gl2.TEXTURE0);
      gl2.bindTexture(gl2.TEXTURE_2D, fb.readTex());
      gl2.uniform1i(presentUniforms.uTex, 0);
      gl2.drawArrays(gl2.TRIANGLES, 0, 3);
      markOk();

      if (!destroyed) raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => {
      destroyed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      for (const p of programs.values()) gl2.deleteProgram(p.program);
      gl2.deleteProgram(presentBundle.program);
      if (fftTex) gl2.deleteTexture(fftTex);
      gl2.deleteVertexArray(vao);
      if (tfUpdate) gl2.deleteProgram(tfUpdate.program);
      if (tfRender) gl2.deleteProgram(tfRender.program);
      disposeTfGpu(tfGpu);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const spec = CONCERT_WEBGL_SCENES.find((s) => s.id === scene);
  return (
    <div className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        className={
          compact
            ? "h-full min-h-[240px] w-full rounded-xl bg-black"
            : "h-full min-h-[620px] w-full rounded-2xl bg-black"
        }
      />
      {showHud && (
        <div className="pointer-events-none absolute left-6 top-6 max-w-[560px] rounded-2xl bg-black/35 px-5 py-4 backdrop-blur-md">
          <div className="text-lg font-semibold text-zinc-50">{spec?.title ?? "WebGL Concert Visualizer"}</div>
          <div className="mt-1 text-xs text-emerald-200/90">
            WebGL · Drive {Math.round(clamp(getConcertAudioLevel(), 0, 1) * 100)}% · EEG bands + audio mix
          </div>
        </div>
      )}
      {webglInfo && !error && (
        <div className="pointer-events-none absolute bottom-4 left-4 max-w-md rounded-lg bg-amber-950/50 px-3 py-2 text-xs text-amber-100/90">
          {webglInfo}
        </div>
      )}
      {error && (
        <div className="absolute inset-0 grid place-items-center rounded-2xl bg-black/80 p-6 text-sm text-zinc-200">
          <div className="max-w-[680px]">
            <div className="text-base font-semibold text-zinc-50">WebGL scene failed to start</div>
            <div className="mt-2 font-mono text-xs leading-relaxed text-zinc-300">{error}</div>
            <div className="mt-4 text-xs text-zinc-400">{webglFailureHint(error)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

