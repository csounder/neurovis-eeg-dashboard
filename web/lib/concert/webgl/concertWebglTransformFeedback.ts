import type { TfPreset } from "@/lib/concert/webgl/concertWebglTfPresets";
import { getUniforms, linkProgram } from "@/lib/concert/webgl/webglKit";

/** Default TF lace spatial scale (kept here to avoid preset ↔ TF module import cycles). */
export const TF_LACE_WORLD_SCALE = 1.42;

/** WebGL2 texture-buffer constants (missing from some TS DOM lib versions). */
const GL_TEXTURE_BUFFER = 0x8c2a;
const GL_RGBA32F = 0x8814;

type GlWithTbo = WebGL2RenderingContext & {
  bindBuffer(target: number, buffer: WebGLBuffer | null): void;
  texBuffer(target: number, internalformat: number, buffer: WebGLBuffer | null): void;
};

function glTbo(gl: WebGL2RenderingContext): GlWithTbo {
  return gl as GlWithTbo;
}

/** Runtime check — some WebGL2 contexts reject TEXTURE_BUFFER binds. */
export function supportsTextureBuffer(gl: WebGL2RenderingContext): boolean {
  const tex = gl.createTexture();
  if (!tex) return false;
  gl.bindTexture(GL_TEXTURE_BUFFER, tex);
  const ok = gl.getError() === gl.NO_ERROR;
  gl.bindTexture(GL_TEXTURE_BUFFER, null);
  gl.deleteTexture(tex);
  return ok;
}

/** Two vec4 per particle: pos+vel, spark meta. Stride = 32 bytes. */
export const TF_PARTICLE_STRIDE = 32;
export const TF_LINES_PER_PARTICLE = 3;

export type TfParticles = {
  count: number;
  srcVao: WebGLVertexArrayObject;
  dstVao: WebGLVertexArrayObject;
  srcBuf: WebGLBuffer;
  dstBuf: WebGLBuffer;
  tf: WebGLTransformFeedback;
  tboTex: WebGLTexture;
  flip: boolean;
};

const SHADER_BRAIN = `
float brainSdf(vec2 p) {
  float a = atan(p.y, p.x);
  float r = length(p);
  float lobe = 1.0 + sin(a * 2.0 - 0.8) * 0.12 + cos(a * 3.0 + 0.6) * 0.08;
  vec2 q = p / (vec2(0.52 * lobe * 1.05, 0.52 * lobe * 0.72));
  return length(q) - 1.0;
}

vec2 brainSurfacePull(vec2 p) {
  float d = brainSdf(p);
  if (d <= 0.0) return vec2(0.0);
  float e = 0.004;
  float dx = brainSdf(p + vec2(e, 0.0)) - brainSdf(p - vec2(e, 0.0));
  float dy = brainSdf(p + vec2(0.0, e)) - brainSdf(p - vec2(0.0, e));
  vec2 n = normalize(vec2(dx, dy) + 1e-5);
  return -n * d * 2.4;
}

// Cortical lace: bright rim + soft shell (no solid center egg).
float tfLaceMask(vec2 p) {
  float d = brainSdf(p);
  float rim = smoothstep(0.13, 0.0, abs(d));
  float shell = smoothstep(0.05, -0.32, d);
  float coreFade = smoothstep(-0.32, -0.06, d);
  return max(rim * (1.0 - coreFade * 0.7), shell * 0.45);
}
`;

const SHADER_BAND = `
vec3 bandColor(float k) {
  vec3 cd = vec3(0.45, 0.78, 1.0);
  vec3 ct = vec3(0.78, 0.62, 1.0);
  vec3 ca = vec3(0.35, 0.98, 0.78);
  vec3 cb = vec3(1.0, 0.82, 0.45);
  vec3 cg = vec3(1.0, 0.52, 0.88);
  float t = clamp(k, 0.0, 1.0);
  if (t < 0.25) return mix(cd, ct, t / 0.25);
  if (t < 0.5) return mix(ct, ca, (t - 0.25) / 0.25);
  if (t < 0.75) return mix(ca, cb, (t - 0.5) / 0.25);
  return mix(cb, cg, (t - 0.75) / 0.25);
}
`;

function initParticlePosition(mode: TfPreset["init"], i: number, count: number): [number, number] {
  const a = (i / count) * Math.PI * 2;
  const u = (i % 997) / 997;
  switch (mode) {
    case "ring": {
      const r = 0.62 + (i % 11) * 0.014;
      return [Math.cos(a) * r, Math.sin(a) * r * 0.68];
    }
    case "shell": {
      const r = 0.92 + Math.sin(a * 3) * 0.04;
      return [Math.cos(a) * r * 0.58, Math.sin(a) * r * 0.42];
    }
    case "twin": {
      const side = i % 2 === 0 ? -1 : 1;
      const r = 0.2 + Math.sqrt(u) * 0.18;
      return [side * (0.14 + r), Math.sin(a * 2) * 0.22];
    }
    case "stream": {
      const x = (u - 0.5) * 1.1;
      const y = Math.sin(a * 2.5) * 0.55;
      return [x, y];
    }
    case "disc": {
      const r = 0.7 + u * 0.38 + (i % 13) * 0.01;
      return [Math.cos(a) * r, Math.sin(a) * r * 0.58];
    }
    case "helix": {
      const t = u * Math.PI * 8 + a * 0.15;
      const r = 0.32 + u * 0.28;
      return [Math.cos(t) * r, (u - 0.5) * 1.75];
    }
    case "scatter": {
      const h1 = ((i * 92837111) % 997) / 997;
      const h2 = ((i * 68928749) % 991) / 991;
      const r = 0.42 + h1 * 0.55;
      const ang = h2 * Math.PI * 2;
      return [Math.cos(ang) * r, Math.sin(ang) * r * (0.62 + h1 * 0.25)];
    }
    case "sheet": {
      const band = Math.floor(u * 10);
      const x = ((i % 137) / 137 - 0.5) * 1.55;
      const y = (band / 10 - 0.5) * 1.35 + Math.sin(a * 3) * 0.06;
      return [x, y];
    }
    case "figure8": {
      const s = 0.62 + u * 0.28;
      const t = a + u * 0.4;
      return [Math.sin(t) * s, Math.sin(t * 2.0) * 0.48 * s];
    }
    case "wedge": {
      const sector = i % 8;
      const r = 0.48 + u * 0.52;
      const ang = a * 0.55 + (sector / 8) * Math.PI * 2;
      return [Math.cos(ang) * r, Math.sin(ang) * r * 0.72];
    }
    case "nova": {
      const burst = i % 3;
      const cx = burst === 0 ? -0.38 : burst === 1 ? 0.38 : 0.0;
      const cy = burst === 2 ? 0.22 : -0.18;
      const r = 0.04 + Math.sqrt(u) * 0.22;
      const ang = a + u * Math.PI * 2;
      return [cx + Math.cos(ang) * r, cy + Math.sin(ang) * r];
    }
    default: {
      const r = 0.58 + u * 0.28 + (i % 19) * 0.011;
      return [Math.cos(a) * r, Math.sin(a) * r * 0.72];
    }
  }
}

export function createTfParticles(gl: WebGL2RenderingContext, preset: TfPreset): TfParticles {
  const count = preset.particleCount;
  const srcBuf = gl.createBuffer();
  const dstBuf = gl.createBuffer();
  const srcVao = gl.createVertexArray();
  const dstVao = gl.createVertexArray();
  const tf = gl.createTransformFeedback();
  const tboTex = gl.createTexture();
  if (!srcBuf || !dstBuf || !srcVao || !dstVao || !tf || !tboTex) {
    throw new Error("WebGL: TF init failed");
  }

  const world = preset.worldScale ?? TF_LACE_WORLD_SCALE;
  const init = new Float32Array(count * 8);
  for (let i = 0; i < count; i += 1) {
    const o = i * 8;
    const [px, py] = initParticlePosition(preset.init, i, count);
    init[o + 0] = px * world;
    init[o + 1] = py * world;
    init[o + 2] = (Math.random() * 2 - 1) * 0.015;
    init[o + 3] = (Math.random() * 2 - 1) * 0.015;
    init[o + 4] = 0; // sparkLife
    init[o + 5] = 0; // sparkBand hint
    init[o + 6] = 0;
    init[o + 7] = 0;
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, srcBuf);
  gl.bufferData(gl.ARRAY_BUFFER, init, gl.DYNAMIC_COPY);
  gl.bindBuffer(gl.ARRAY_BUFFER, dstBuf);
  gl.bufferData(gl.ARRAY_BUFFER, init.byteLength, gl.DYNAMIC_COPY);

  const bindVao = (vao: WebGLVertexArrayObject, buf: WebGLBuffer) => {
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, TF_PARTICLE_STRIDE, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, TF_PARTICLE_STRIDE, 16);
    gl.bindVertexArray(null);
  };
  bindVao(srcVao, srcBuf);
  bindVao(dstVao, dstBuf);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  return { count, srcVao, dstVao, srcBuf, dstBuf, tf, tboTex, flip: false };
}

export function tfSrcVao(p: TfParticles) {
  return p.flip ? p.dstVao : p.srcVao;
}
export function tfDstBuf(p: TfParticles) {
  return p.flip ? p.srcBuf : p.dstBuf;
}
export function tfDrawBuf(p: TfParticles) {
  return p.flip ? p.dstBuf : p.srcBuf;
}
export function tfDrawVao(p: TfParticles) {
  return p.flip ? p.dstVao : p.srcVao;
}
export function tfSwap(p: TfParticles) {
  p.flip = !p.flip;
}

/** Bind latest particle buffer as RGBA32F texture buffer (2 texels / particle). */
export function bindTfParticleTbo(gl: WebGL2RenderingContext, p: TfParticles, unit: number): boolean {
  if (!supportsTextureBuffer(gl)) return false;
  const buf = tfDrawBuf(p);
  const g = glTbo(gl);
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(GL_TEXTURE_BUFFER, p.tboTex);
  g.bindBuffer(GL_TEXTURE_BUFFER, buf);
  g.texBuffer(GL_TEXTURE_BUFFER, GL_RGBA32F, buf);
  return gl.getError() === gl.NO_ERROR;
}

function linkTfProgram(gl: WebGL2RenderingContext, vsSrc: string, fsSrc: string, varyings: string[]) {
  const program = gl.createProgram();
  if (!program) throw new Error("WebGL: createProgram failed");
  const vs = gl.createShader(gl.VERTEX_SHADER);
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  if (!vs || !fs) throw new Error("WebGL: createShader failed");
  gl.shaderSource(vs, vsSrc);
  gl.compileShader(vs);
  if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(vs) || "TF VS compile failed");
  }
  gl.shaderSource(fs, fsSrc);
  gl.compileShader(fs);
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(fs) || "TF FS compile failed");
  }
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  if (varyings.length > 0) {
    gl.transformFeedbackVaryings(program, varyings, gl.INTERLEAVED_ATTRIBS);
  }
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || "TF link failed");
  }
  return program;
}

export function makeTfUpdateProgram(gl: WebGL2RenderingContext) {
  const VS = `#version 300 es
precision highp float;
layout(location=0) in vec4 aPosVel;
layout(location=1) in vec4 aMeta; // sparkLife, sparkBand, synapseX, synapseY
uniform float uTime;
uniform float uDt;
uniform float uAudio;
uniform float uSynapseDrive;
uniform vec2 uSyn0;
uniform vec2 uSyn1;
uniform vec2 uSyn2;
uniform float uFlowGain;
uniform float uShellGain;
uniform float uCurlScale;
uniform float uInwardGain;
uniform float uSynapsePull;
uniform float uSynapseRate;
uniform vec4 uBands;
uniform vec4 uBands2;
uniform vec4 uChannels;
uniform int uCount;
out vec4 vPosVel;
out vec4 vMeta;

${SHADER_BRAIN}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

float hash11(float p) {
  return fract(sin(p * 127.1) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

vec2 curl(vec2 p) {
  float e = 0.0025;
  float n1 = noise(p + vec2(0.0, e));
  float n2 = noise(p - vec2(0.0, e));
  float a = (n1 - n2) / (2.0 * e);
  n1 = noise(p + vec2(e, 0.0));
  n2 = noise(p - vec2(e, 0.0));
  float b = (n1 - n2) / (2.0 * e);
  return vec2(a, -b);
}

vec2 synapsePoint(int slot) {
  if (slot == 0) return uSyn0;
  if (slot == 1) return uSyn1;
  return uSyn2;
}

void main(){
  vec2 pos = aPosVel.xy;
  vec2 vel = aPosVel.zw;
  float sparkLife = aMeta.x;
  float sparkBand = aMeta.y;
  vec2 synPos = aMeta.zw;
  float drive = clamp(uAudio + uBands2.x * 0.45 + uBands.w * 0.25, 0.0, 1.6);

  vec2 a0 = synapsePoint(0);
  vec2 a1 = synapsePoint(1);
  vec2 a2 = synapsePoint(2);
  vec2 f0 = (a0 - pos) * (0.22 + uBands.z * 0.32);
  vec2 f1 = (a1 - pos) * (0.22 + uBands2.x * 0.32);
  vec2 f2 = (a2 - pos) * (0.16 + uBands.y * 0.32);

  vec2 c = curl(pos * (uCurlScale + drive * 1.2) + vec2(uTime * 0.05, -uTime * 0.035));
  vec2 flow = c * uFlowGain * (0.55 + drive * 0.35);

  vec2 shell = brainSurfacePull(pos) * uShellGain * (0.65 + uBands.z * 0.28);
  float outside = smoothstep(-0.04, 0.14, brainSdf(pos));
  vec2 inward = -normalize(pos + vec2(1e-4)) * uInwardGain * outside * 0.35;

  vec2 acc = (f0 + f1 + f2) * uSynapsePull + flow + shell + inward;
  vel += acc * (0.22 + drive * 0.38) * uDt;
  vel *= 0.988 - 0.008 * min(1.0, drive);
  pos += vel * uDt;

  sparkLife = max(0.0, sparkLife - uDt * (1.8 + drive * 0.6));

  float id = float(gl_VertexID);
  float gate = uSynapseDrive * (0.55 + uBands2.x * 0.85 + uAudio * 0.45);
  if (gate > 0.22 && hash11(id * 0.017 + floor(uTime * 14.0)) < gate * uSynapseRate) {
    int slot = int(mod(floor(hash11(id + uTime) * 3.0), 3.0));
    vec2 syn = synapsePoint(slot);
    pos = mix(pos, syn + (vec2(hash11(id), hash11(id + 7.0)) - 0.5) * 0.06, 0.55);
    vel *= 0.35;
    sparkLife = 1.0;
    sparkBand = float(slot) / 2.0;
    synPos = syn;
  }

  if (brainSdf(pos) > 0.08) {
    pos -= brainSurfacePull(pos) * 0.35;
    vel *= 0.82;
  }

  vPosVel = vec4(pos, vel);
  vMeta = vec4(sparkLife, sparkBand, synPos);
}`;

  const FS = `#version 300 es
precision highp float;
void main(){}`;

  const program = linkTfProgram(gl, VS, FS, ["vPosVel", "vMeta"]);
  const uniforms = getUniforms(gl, program, [
    "uTime",
    "uDt",
    "uAudio",
    "uSynapseDrive",
    "uSyn0",
    "uSyn1",
    "uSyn2",
    "uFlowGain",
    "uShellGain",
    "uCurlScale",
    "uInwardGain",
    "uSynapsePull",
    "uSynapseRate",
    "uBands",
    "uBands2",
    "uChannels",
    "uCount",
  ]);
  return { program, uniforms };
}

export function bindTfUpdateUniforms(
  gl: WebGL2RenderingContext,
  u: ReturnType<typeof makeTfUpdateProgram>["uniforms"],
  preset: TfPreset,
  args: {
    time: number;
    dt: number;
    audio: number;
    synapseDrive: number;
    bands: { delta: number; theta: number; alpha: number; beta: number; gamma: number };
    channels: number[];
    count: number;
  },
  scale?: { flow?: number; dt?: number },
) {
  gl.uniform1f(u.uTime, args.time);
  gl.uniform1f(u.uDt, args.dt * (scale?.dt ?? 1));
  gl.uniform1f(u.uAudio, args.audio);
  gl.uniform1f(u.uSynapseDrive, args.synapseDrive);
  const world = preset.worldScale ?? TF_LACE_WORLD_SCALE;
  gl.uniform2f(u.uSyn0, preset.synapses[0][0] * world, preset.synapses[0][1] * world);
  gl.uniform2f(u.uSyn1, preset.synapses[1][0] * world, preset.synapses[1][1] * world);
  gl.uniform2f(u.uSyn2, preset.synapses[2][0] * world, preset.synapses[2][1] * world);
  gl.uniform1f(u.uFlowGain, preset.flowGain * (scale?.flow ?? 1));
  gl.uniform1f(u.uShellGain, preset.shellGain);
  gl.uniform1f(u.uCurlScale, preset.curlScale);
  gl.uniform1f(u.uInwardGain, preset.inwardGain * 0.4);
  gl.uniform1f(u.uSynapsePull, preset.synapsePull);
  gl.uniform1f(u.uSynapseRate, preset.synapseRate);
  gl.uniform4f(u.uBands, args.bands.delta, args.bands.theta, args.bands.alpha, args.bands.beta);
  gl.uniform4f(u.uBands2, args.bands.gamma, 0, 0, 0);
  gl.uniform4f(
    u.uChannels,
    args.channels[0] ?? 0,
    args.channels[1] ?? 0,
    args.channels[2] ?? 0,
    args.channels[3] ?? 0,
  );
  gl.uniform1i(u.uCount, args.count);
}

export function makeTfLineProgram(gl: WebGL2RenderingContext, preset: TfPreset) {
  const [o0, o1, o2] = preset.lineOffsets;
  const slots = preset.lineSlots;
  const VS = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform int uCount;
uniform samplerBuffer uParticles;
uniform int uLineSlots;
uniform float uLineGain;
out float vBandK;
out float vStrength;
out float vDist;

${SHADER_BRAIN}

vec4 fetchParticle(int idx) {
  int base = idx * 2;
  return texelFetch(uParticles, base);
}

vec4 fetchMeta(int idx) {
  return texelFetch(uParticles, idx * 2 + 1);
}

void main(){
  int vid = gl_VertexID;
  int lineId = vid / 2;
  int endPt = vid % 2;
  int p = lineId / ${slots};
  int slot = lineId - p * ${slots};
  if (slot >= uLineSlots) {
    gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
    return;
  }
  int o0 = ${o0};
  int o1 = ${o1};
  int o2 = ${o2};
  int q = p;
  if (slot == 0) q = (p + o0) % max(uCount, 1);
  else if (slot == 1) q = (p + o1) % max(uCount, 1);
  else q = (p + o2) % max(uCount, 1);
  int idx = endPt == 0 ? p : q;

  vec4 s = fetchParticle(idx);
  vec2 pos = s.xy;
  float dA = brainSdf(pos);
  vDist = abs(dA);

  vec4 meta = fetchMeta(idx);
  float spark = meta.x;
  vBandK = fract((atan(pos.y, pos.x) / 6.28318) + 0.5 + meta.y * 0.2);
  vStrength = tfLaceMask(pos) * (0.55 + spark * 1.1) + spark * 0.55;

  vec2 clip = pos;
  clip.x *= uRes.y / max(1.0, uRes.x);
  gl_Position = vec4(clip, 0.0, 1.0);
}`;

  const FS = `#version 300 es
precision highp float;
in float vBandK;
in float vStrength;
in float vDist;
uniform float uAudio;
uniform float uSynapseFlash;
uniform float uLineGain;
out vec4 fragColor;

${SHADER_BAND}

void main(){
  if (vStrength < 0.02) discard;
  vec3 c = bandColor(vBandK);
  float edge = smoothstep(0.12, 0.0, vDist);
  float a = vStrength * (0.1 + edge * 0.16) * (0.85 + uAudio * 0.45) * uLineGain;
  a += uSynapseFlash * vStrength * 0.18 * uLineGain;
  fragColor = vec4(c * (0.45 + vStrength * 0.85), min(a, 0.95));
}`;

  const program = linkProgram(gl, VS, FS);
  const uniforms = getUniforms(gl, program, [
    "uRes",
    "uCount",
    "uParticles",
    "uLineSlots",
    "uAudio",
    "uSynapseFlash",
    "uLineGain",
  ]);
  return { program, uniforms, lineSlots: slots };
}

export function makeTfRenderProgram(gl: WebGL2RenderingContext) {
  const VS = `#version 300 es
precision highp float;
layout(location=0) in vec4 aPosVel;
layout(location=1) in vec4 aMeta;
uniform vec2 uRes;
uniform float uAudio;
uniform float uSynapseFlash;
uniform float uPointGain;
uniform vec4 uBands;
uniform vec4 uBands2;
out float vGlow;
out float vBandK;
out float vSpark;

${SHADER_BRAIN}

void main(){
  vec2 pos = aPosVel.xy;
  float spark = aMeta.x;
  float rim = tfLaceMask(pos);
  float drive = clamp(uAudio + uBands2.x * 0.4, 0.0, 1.4);
  vBandK = fract((atan(pos.y, pos.x) / 6.28318) + 0.5 + aMeta.y * 0.25);
  vSpark = spark;
  vGlow = rim * (0.48 + drive * 0.72) + spark * (0.9 + uSynapseFlash * 1.0);
  vec2 clip = pos;
  clip.x *= uRes.y / max(1.0, uRes.x);
  gl_Position = vec4(clip, 0.0, 1.0);
  float resScale = clamp(min(uRes.x, uRes.y) / 880.0, 0.9, 2.6);
  gl_PointSize = uPointGain * resScale * (3.2 + 3.0 * vGlow + spark * 6.5 + uSynapseFlash * 3.5);
}`;

  const FS = `#version 300 es
precision highp float;
in float vGlow;
in float vBandK;
in float vSpark;
uniform float uSynapseFlash;
uniform float uPointGain;
out vec4 fragColor;

${SHADER_BAND}

void main(){
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d = dot(p, p);
  float core = exp(-d * (8.0 + vSpark * 12.0));
  float halo = exp(-d * (2.8 + vGlow * 3.2));
  vec3 c = bandColor(vBandK);
  vec3 syn = mix(c, vec3(1.0, 0.55, 0.9), vSpark * 0.8);
  float a = (core * (0.16 + vGlow * 0.38) + halo * (0.06 + vSpark * 0.16)) * uPointGain;
  a += uSynapseFlash * vSpark * 0.5 * uPointGain;
  vec3 rgb = syn * (0.5 + vGlow * 1.25 + vSpark * 0.85);
  fragColor = vec4(rgb, min(a * 1.15, 0.98));
}`;

  const bundle = linkProgram(gl, VS, FS);
  const uniforms = getUniforms(gl, bundle.program, [
    "uRes",
    "uAudio",
    "uSynapseFlash",
    "uPointGain",
    "uBands",
    "uBands2",
  ]);
  return { program: bundle.program, uniforms };
}

/** Lines: N segments × 2 vertices per particle. */
export function tfLineVertexCount(count: number, lineSlots: number = TF_LINES_PER_PARTICLE) {
  return count * lineSlots * 2;
}
