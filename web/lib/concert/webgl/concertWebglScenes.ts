import {
  TF_WEBGL_ALL_SCENES,
  TF_WEBGL_LACE_SCENES,
  TF_WEBGL_MACRO_SCENES,
  type TfWebglSceneId,
} from "@/lib/concert/webgl/concertWebglTfPresets";

export {
  TF_WEBGL_ALL_SCENES,
  TF_WEBGL_LACE_SCENES,
  TF_WEBGL_MACRO_SCENES,
  TF_WEBGL_SCENE_IDS,
  isTfMacroScene,
  isTfWebglScene,
  tfPresetForScene,
} from "@/lib/concert/webgl/concertWebglTfPresets";
export type { TfWebglSceneId };

const FULLSCREEN_WEBGL_SCENES = [
  { id: "glNeuroRaymarch" as const, title: "GL Aurora Drift", subtitle: "WebGL · multi-layer curl aurora across the stage (no center mass)." },
  { id: "glSynapseFilaments" as const, title: "GL Caustic Weave", subtitle: "WebGL · off-axis filament caustics + band tint." },
  { id: "glGalaxyBrainNebula" as const, title: "GL Deep Starfield", subtitle: "WebGL · spiral arms + parallax dust (no cortical egg)." },
  { id: "glCurlNoiseParticles" as const, title: "GL Curl Veil", subtitle: "WebGL · flow-field veil with sparkle dust." },
  { id: "glBrainScanlines" as const, title: "GL Isoline Terrain", subtitle: "WebGL · noise contour terrain (not a brain mask)." },
  { id: "glInterferenceLattice" as const, title: "GL Moiré Lattice", subtitle: "WebGL · perspective interference grid in the void." },
  { id: "glMetaballNeurons" as const, title: "GL Orbital Sparks", subtitle: "WebGL · ring of synaptic sparks + hairline links." },
] as const;

export type FullscreenWebglSceneId = (typeof FULLSCREEN_WEBGL_SCENES)[number]["id"];

export const CONCERT_WEBGL_FULLSCREEN_SCENES = FULLSCREEN_WEBGL_SCENES;

const mapTfScenes = (scenes: readonly { id: string; title: string; subtitle: string }[]) =>
  scenes.map((s) => ({ id: s.id, title: s.title, subtitle: s.subtitle }));

export const CONCERT_WEBGL_TF_LACE_SCENES = mapTfScenes(TF_WEBGL_LACE_SCENES);
export const CONCERT_WEBGL_TF_MACRO_SCENES = mapTfScenes(TF_WEBGL_MACRO_SCENES);
export const CONCERT_WEBGL_TF_SCENES = mapTfScenes(TF_WEBGL_ALL_SCENES);

export const CONCERT_WEBGL_SCENES = [...CONCERT_WEBGL_FULLSCREEN_SCENES, ...CONCERT_WEBGL_TF_SCENES] as const;

export type ConcertWebglSceneId = FullscreenWebglSceneId | TfWebglSceneId;

export const WEBGL_SCENE_IDS = new Set<string>(CONCERT_WEBGL_SCENES.map((s) => s.id));

export const WEBGL_VERTEX = `#version 300 es
precision highp float;
const vec2 POS[3] = vec2[3](vec2(-1., -1.), vec2(3., -1.), vec2(-1., 3.));
out vec2 vUv;
void main() {
  vec2 p = POS[gl_VertexID];
  vUv = 0.5 * (p + 1.0);
  gl_Position = vec4(p, 0.0, 1.0);
}`;

/** Shared cinematic GLSL — void + flow utilities (no brain SDF / no center egg). */
const COMMON = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform vec2 uRes;
uniform float uTime;
uniform float uAudio;
uniform float uTrails;
uniform vec4 uBands;
uniform vec4 uBands2;
uniform vec4 uChannels;
uniform sampler2D uFftTex;
uniform sampler2D uPrev;

vec2 uv01() { return gl_FragCoord.xy / max(uRes, vec2(1.0)); }

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float noise3(vec3 p) {
  vec2 i = floor(p.xy + p.z * 17.0);
  return noise(i + fract(p.z) * 13.1);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot2 = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = rot2 * p * 2.03 + vec2(11.7, 5.2);
    a *= 0.5;
  }
  return v;
}

float fbm3(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise3(p);
    p = p * 2.1 + vec3(3.1, 1.7, 2.3);
    a *= 0.5;
  }
  return v;
}

vec2 rot(vec2 p, float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c) * p;
}

float fftAt(float x01) {
  return clamp(texture(uFftTex, vec2(clamp(x01, 0.0, 1.0), 0.5)).x, 0.0, 1.0);
}

vec3 bandColor(float k) {
  vec3 cd = vec3(0.32, 0.58, 0.95);
  vec3 ct = vec3(0.62, 0.48, 0.98);
  vec3 ca = vec3(0.22, 0.88, 0.68);
  vec3 cb = vec3(0.98, 0.72, 0.38);
  vec3 cg = vec3(0.98, 0.42, 0.78);
  float t = clamp(k, 0.0, 1.0);
  if (t < 0.25) return mix(cd, ct, t / 0.25);
  if (t < 0.5) return mix(ct, ca, (t - 0.25) / 0.25);
  if (t < 0.75) return mix(ca, cb, (t - 0.5) / 0.25);
  return mix(cb, cg, (t - 0.75) / 0.25);
}

float drive() {
  return clamp(uAudio * 0.7 + uBands.z * 0.22 + uBands2.x * 0.28 + uBands.w * 0.12, 0.0, 1.0);
}

vec2 aspectUv() {
  vec2 uv = uv01() * 2.0 - 1.0;
  uv.x *= uRes.x / max(1.0, uRes.y);
  return uv;
}

vec2 curl2(vec2 p) {
  float e = 0.0025;
  float n = fbm(p);
  float nx = fbm(p + vec2(e, 0.0)) - n;
  float ny = fbm(p + vec2(0.0, e)) - n;
  return vec2(ny, -nx) / e;
}

// Cinematic void — gradient + stars
vec3 voidBg(vec2 p) {
  float r = length(p);
  vec3 zenith = vec3(0.01, 0.016, 0.038);
  vec3 ground = vec3(0.004, 0.006, 0.014);
  vec3 col = mix(ground, zenith, smoothstep(-1.2, 0.9, p.y));
  float stars = pow(hash21(floor(p * 420.0)), 18.0) * (0.35 + 0.65 * hash21(p * 90.0));
  col += vec3(0.55, 0.7, 0.95) * stars * smoothstep(0.15, 0.95, fbm(p * 3.0));
  float neb = fbm(p * 0.9 + vec2(uTime * 0.008, -uTime * 0.006));
  col += bandColor(0.2 + neb * 0.35) * neb * 0.04;
  col *= 1.0 - 0.22 * r * r;
  return col;
}

vec3 aces(vec3 x) {
  x = max(x, 0.0);
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

vec3 grade(vec3 col) {
  float d = drive();
  col = aces(col * (1.08 + d * 0.22));
  vec2 uv = aspectUv();
  col *= 1.0 - 0.22 * dot(uv, uv);
  return col;
}
`;

function withMain(body: string) {
  return `${COMMON}\nvoid main(){\n${body}\n}\n`;
}

const TF_STUB = withMain(`fragColor = vec4(0.0, 0.0, 0.0, 1.0);`);

export function fragmentForScene(id: ConcertWebglSceneId): string {
  if (id.startsWith("glTf")) return TF_STUB;

  switch (id) {
    case "glNeuroRaymarch":
      return withMain(`
  vec2 p = aspectUv();
  float dAmt = drive();
  vec3 col = voidBg(p);
  vec2 drift = vec2(sin(uTime * 0.05), cos(uTime * 0.04)) * 0.18;
  vec2 c = curl2(p * 1.35 + drift + vec2(uTime * 0.02, -uTime * 0.015));
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    vec2 q = p + c * (0.06 + fi * 0.035) + vec2(cos(uTime * 0.09 + fi * 2.3), sin(uTime * 0.07 + fi * 1.9)) * (0.38 + fi * 0.11);
    float n = fbm(q * (1.8 + fi * 0.25) + vec2(uTime * 0.018, fi * 0.4));
    float aur = pow(abs(sin(n * 14.0 + dot(q, c) * 2.5 + uTime * 0.15)), 2.4);
    col += bandColor(0.12 + fi * 0.16 + uBands.z * 0.12) * aur * (0.14 + dAmt * 0.24);
  }
  float dust = pow(hash21(floor(p * 95.0 + uTime * 0.12)), 15.0);
  col += bandColor(fract(dust + uBands.y)) * dust * (0.2 + dAmt * 0.35);
  fragColor = vec4(grade(col), 1.0);
`);
    case "glSynapseFilaments":
      return withMain(`
  vec2 p = aspectUv();
  float dAmt = drive();
  vec3 col = voidBg(p);
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    vec2 dir = vec2(cos(fi * 1.0472 + 0.4), sin(fi * 1.0472 + 0.4));
    vec2 q = p - dir * (0.48 + sin(uTime * 0.06 + fi) * 0.14);
    float n = fbm(q * 2.8 + dir * uTime * 0.025);
    float fil = pow(abs(sin((q.x + n * 0.35) * (16.0 + fi * 1.2) + uTime * (0.2 + dAmt * 0.15))), 20.0);
    fil += pow(abs(sin((q.y - n * 0.2) * (13.0 + fi) - uTime * 0.12)), 22.0) * 0.6;
    col += bandColor(0.18 + fi * 0.13 + n * 0.2) * fil * (0.1 + dAmt * 0.2);
  }
  fragColor = vec4(grade(col), 1.0);
`);
    case "glGalaxyBrainNebula":
      return withMain(`
  vec2 p = aspectUv();
  float dAmt = drive();
  vec3 col = voidBg(p);
  float ang = atan(p.y, p.x);
  float r = length(p);
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float arm = ang * (3.8 + fi * 0.4) + r * (5.5 - fi * 0.5) - uTime * (0.07 + fi * 0.018);
    float dust = fbm(vec2(r * 2.2 - uTime * 0.018, arm * 0.45 + fi));
    dust *= exp(-r * (0.75 + fi * 0.15));
    col += bandColor(0.15 + fi * 0.18 + uBands.x * 0.1) * dust * (0.12 + dAmt * 0.18);
  }
  float stars = pow(hash21(floor(p * 120.0)), 17.0);
  col += vec3(0.75, 0.88, 1.0) * stars * (0.25 + dAmt * 0.4);
  fragColor = vec4(grade(col), 1.0);
`);
    case "glCurlNoiseParticles":
      return withMain(`
  vec2 uv = uv01();
  vec2 p = aspectUv();
  float dAmt = drive();
  vec3 col = voidBg(p);
  vec2 c = curl2(p * 1.25 + vec2(uTime * 0.02, -uTime * 0.016));
  vec2 flow = c * (0.004 + dAmt * 0.006);
  vec3 adv = texture(uPrev, uv - flow).rgb;
  col = mix(col, adv, uTrails * 0.48);
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    vec2 q = p + c * (0.05 + fi * 0.03) + vec2(sin(uTime * 0.08 + fi), cos(uTime * 0.06 + fi * 1.4)) * 0.25;
    float n = fbm(q * 2.2 + fi);
    float aur = pow(abs(sin(n * 11.0 + dot(q, c) * 2.2)), 2.8);
    col += bandColor(0.2 + fi * 0.15 + uBands.z * 0.1) * aur * (0.08 + dAmt * 0.14);
  }
  float fleck = pow(hash21(floor(p * 70.0 + uTime * 0.18)), 15.0);
  col += bandColor(fract(fleck + uTime * 0.03)) * fleck * (0.18 + dAmt * 0.28);
  fragColor = vec4(grade(col), 1.0);
`);
    case "glBrainScanlines":
      return withMain(`
  vec2 uv = uv01();
  vec2 p = aspectUv();
  float dAmt = drive();
  vec3 col = voidBg(p);
  float n = fbm(p * 2.4 + vec2(0.0, uTime * 0.05));
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    float level = 0.08 + fi * 0.095;
    float iso = smoothstep(0.018, 0.0, abs(fract(n * 5.0 + uTime * 0.025) - level));
    col += bandColor(fi / 8.0 + uBands.y * 0.08) * iso * (0.14 + dAmt * 0.22);
  }
  float sweep = smoothstep(0.03, 0.0, abs(p.y - sin(p.x * 2.0 + uTime * 0.2) * 0.35)) * 0.12;
  col += bandColor(0.65) * sweep * (0.5 + dAmt);
  vec3 prev = texture(uPrev, uv).rgb;
  col = mix(col, prev * 0.992, uTrails * 0.12);
  fragColor = vec4(grade(col), 1.0);
`);
    case "glInterferenceLattice":
      return withMain(`
  vec2 p = rot(aspectUv(), uTime * 0.01);
  float dAmt = drive();
  vec3 col = voidBg(p);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float z = 0.35 + fi * 0.22 + p.y * 0.2;
    float persp = 1.0 / (1.15 + z);
    vec2 q = (p + vec2(fi * 0.15, sin(uTime * 0.04 + fi))) * persp;
    float lat = sin(q.x * (12.0 + fi * 2.0) + uTime * 0.2 + fbm(q) * 1.2);
    lat *= sin(q.y * (11.0 + fi * 1.5) - uTime * 0.16);
    float grid = pow(abs(lat), 3.5) * persp * (0.08 + dAmt * 0.16);
    col += bandColor(0.28 + fi * 0.2) * grid;
  }
  fragColor = vec4(grade(col), 1.0);
`);
    case "glMetaballNeurons":
      return withMain(`
  vec2 p = aspectUv();
  float dAmt = drive();
  vec3 col = voidBg(p);
  for (int i = 0; i < 14; i++) {
    float fi = float(i);
    float ang = fi * 2.399963 + uTime * 0.045;
    float rad = 0.52 + mod(fi, 5.0) * 0.09;
    vec2 c = vec2(cos(ang), sin(ang * 0.93)) * rad;
    c += vec2(sin(uTime * 0.07 + fi * 1.3), cos(uTime * 0.06 + fi * 0.9)) * 0.06;
    float d = length(p - c);
    col += bandColor(fract(fi * 0.09 + uBands.w * 0.12)) * exp(-d * d * 200.0) * (0.4 + dAmt * 0.55);
    int j = (i + 3) % 14;
    float ang2 = float(j) * 2.399963 + uTime * 0.038;
    float rad2 = 0.5 + mod(float(j), 5.0) * 0.1;
    vec2 c2 = vec2(cos(ang2), sin(ang2 * 0.91)) * rad2;
    float link = exp(-length(p - (c + c2) * 0.5) * 12.0) * 0.04;
    col += bandColor(0.55) * link * (0.35 + dAmt);
  }
  float fleck = pow(hash21(floor(p * 60.0 + uTime * 0.2)), 16.0) * dAmt;
  col += vec3(1.0, 0.5, 0.88) * fleck * 0.35;
  fragColor = vec4(grade(col), 1.0);
`);
    default:
      return TF_STUB;
  }
}
