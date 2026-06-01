import { getUniforms, linkProgram } from "@/lib/concert/webgl/webglKit";
import { WEBGL_VERTEX } from "@/lib/concert/webgl/concertWebglScenes";

export type SpectrogramState = {
  w: number;
  h: number;
  aTex: WebGLTexture;
  bTex: WebGLTexture;
  aFbo: WebGLFramebuffer;
  bFbo: WebGLFramebuffer;
  flip: boolean;
};

function makeTex(gl: WebGL2RenderingContext, w: number, h: number): WebGLTexture {
  const tex = gl.createTexture();
  if (!tex) throw new Error("WebGL: createTexture failed");
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
}

function makeFbo(gl: WebGL2RenderingContext, tex: WebGLTexture): WebGLFramebuffer {
  const fbo = gl.createFramebuffer();
  if (!fbo) throw new Error("WebGL: createFramebuffer failed");
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    gl.deleteFramebuffer(fbo);
    throw new Error("WebGL: spectrogram framebuffer incomplete.");
  }
  return fbo;
}

export function createSpectrogram(gl: WebGL2RenderingContext, w: number, h: number): SpectrogramState {
  const aTex = makeTex(gl, w, h);
  const bTex = makeTex(gl, w, h);
  const aFbo = makeFbo(gl, aTex);
  const bFbo = makeFbo(gl, bTex);
  // clear
  gl.bindFramebuffer(gl.FRAMEBUFFER, aFbo);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.bindFramebuffer(gl.FRAMEBUFFER, bFbo);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { w, h, aTex, bTex, aFbo, bFbo, flip: false };
}

export function spectroReadTex(s: SpectrogramState): WebGLTexture {
  return s.flip ? s.aTex : s.bTex;
}
export function spectroWriteFbo(s: SpectrogramState): WebGLFramebuffer {
  return s.flip ? s.bFbo : s.aFbo;
}
export function spectroSwap(s: SpectrogramState): void {
  s.flip = !s.flip;
}

export function resizeSpectrogram(gl: WebGL2RenderingContext, s: SpectrogramState, w: number, h: number) {
  if (w === s.w && h === s.h) return;
  s.w = w;
  s.h = h;
  for (const tex of [s.aTex, s.bTex]) {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  }
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, s.aFbo);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.bindFramebuffer(gl.FRAMEBUFFER, s.bFbo);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

export function makeSpectrogramUpdateProgram(gl: WebGL2RenderingContext) {
  const FS = `#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec2 uRes;
uniform sampler2D uPrev;   // spectrogram texture (time x freq)
uniform sampler2D uFftTex; // 1xN float texture
uniform float uDecay;      // 0..1

float fftAt(float x01) {
  vec4 v = texture(uFftTex, vec2(clamp(x01, 0.0, 1.0), 0.5));
  return clamp(v.x, 0.0, 1.0);
}

void main(){
  vec2 uv = gl_FragCoord.xy / max(uRes, vec2(1.0));
  float dx = 1.0 / max(1.0, uRes.x);
  // shift left: read from the right neighbor
  vec4 prev = texture(uPrev, vec2(uv.x + dx, uv.y));
  prev *= uDecay;
  // write new column at right edge
  float isNew = step(1.0 - dx * 1.5, uv.x);
  float f = 1.0 - uv.y; // low at bottom
  float v = fftAt(f);
  vec4 col = vec4(v, v * v, sqrt(max(v, 0.0)), 1.0);
  fragColor = mix(prev, col, isNew);
}`;
  const bundle = linkProgram(gl, WEBGL_VERTEX, FS);
  const uniforms = getUniforms(gl, bundle.program, ["uRes", "uPrev", "uFftTex", "uDecay"]);
  return { program: bundle.program, uniforms };
}

export type WaterfallMesh = {
  vao: WebGLVertexArrayObject;
  vbo: WebGLBuffer;
  ibo: WebGLBuffer;
  indexCount: number;
  cols: number;
  rows: number;
};

export function createWaterfallMesh(gl: WebGL2RenderingContext, cols: number, rows: number): WaterfallMesh {
  // grid in [0..1]x[0..1] : x=time (old->new), y=freq (low->high)
  const verts = new Float32Array(cols * rows * 2);
  let o = 0;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      verts[o++] = x / (cols - 1);
      verts[o++] = y / (rows - 1);
    }
  }
  const quadsX = cols - 1;
  const quadsY = rows - 1;
  const idx = new Uint32Array(quadsX * quadsY * 6);
  let ii = 0;
  const v = (x: number, y: number) => y * cols + x;
  for (let y = 0; y < quadsY; y += 1) {
    for (let x = 0; x < quadsX; x += 1) {
      const a = v(x, y);
      const b = v(x + 1, y);
      const c = v(x, y + 1);
      const d = v(x + 1, y + 1);
      idx[ii++] = a;
      idx[ii++] = c;
      idx[ii++] = b;
      idx[ii++] = b;
      idx[ii++] = c;
      idx[ii++] = d;
    }
  }

  const vao = gl.createVertexArray();
  const vbo = gl.createBuffer();
  const ibo = gl.createBuffer();
  if (!vao || !vbo || !ibo) throw new Error("WebGL: create mesh buffers failed");

  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  gl.bindVertexArray(null);

  return { vao, vbo, ibo, indexCount: idx.length, cols, rows };
}

export function makeWaterfallRenderProgram(gl: WebGL2RenderingContext) {
  const VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 aUv; // (time,freq)
uniform vec2 uRes;
uniform float uTime;
uniform float uAudio;
uniform vec4 uBands;
uniform vec4 uBands2;
uniform sampler2D uSpec; // time x freq (rgba8 encoded)
out vec2 vUv;
out float vAmp;

float specAt(vec2 uv){
  vec4 s = texture(uSpec, vec2(uv.x, 1.0 - uv.y));
  return clamp(s.r, 0.0, 1.0);
}

void main(){
  vUv = aUv;
  float a = specAt(aUv);
  vAmp = a;
  // 3D waterfall: x across time, y across freq, z is amplitude
  float x = (aUv.x * 2.0 - 1.0);
  float y = (aUv.y * 1.7 - 0.65);
  float z = a * (0.9 + uAudio * 0.8);
  // perspective
  float tilt = 0.85;
  float depth = 1.4 - aUv.x * 1.1;
  vec3 p = vec3(x, y, z);
  p.y = p.y + z * 0.35;
  p = vec3(p.x, p.y * tilt - depth * 0.2, p.z + depth * 0.65);
  float inv = 1.0 / (1.2 + p.z);
  vec2 clip = p.xy * inv;
  clip.x *= uRes.y / max(1.0, uRes.x);
  gl_Position = vec4(clip, 0.0, 1.0);
  gl_PointSize = 1.0;
}`;

  const FS = `#version 300 es
precision highp float;
in vec2 vUv;
in float vAmp;
out vec4 fragColor;
uniform float uAudio;
uniform vec4 uBands;
uniform vec4 uBands2;

vec3 bandColor(float k) {
  vec3 cd = vec3(0.314, 0.608, 1.0);
  vec3 ct = vec3(0.647, 0.47, 1.0);
  vec3 ca = vec3(0.176, 0.882, 0.627);
  vec3 cb = vec3(1.0, 0.706, 0.235);
  vec3 cg = vec3(1.0, 0.353, 0.725);
  float t = clamp(k, 0.0, 1.0);
  if (t < 0.25) return mix(cd, ct, t / 0.25);
  if (t < 0.5) return mix(ct, ca, (t - 0.25) / 0.25);
  if (t < 0.75) return mix(ca, cb, (t - 0.5) / 0.25);
  return mix(cb, cg, (t - 0.75) / 0.25);
}

vec3 tonemap(vec3 c){ return c / (1.0 + c); }

void main(){
  // Delicate wireframe feel: fade with freq + time, brighten peaks.
  float k = vUv.y;
  vec3 c = bandColor(k);
  float edge = smoothstep(0.0, 0.5, vAmp);
  float alpha = (0.03 + 0.22 * edge) * (0.55 + uAudio * 0.6);
  // Subtle scanline shimmer
  alpha *= 0.8 + 0.2 * sin((vUv.y * 180.0) + uAudio * 10.0);
  fragColor = vec4(tonemap(c * (0.12 + vAmp * 1.6)), alpha);
}`;
  const bundle = linkProgram(gl, VS, FS);
  const uniforms = getUniforms(gl, bundle.program, ["uRes", "uTime", "uAudio", "uBands", "uBands2", "uSpec"]);
  return { program: bundle.program, uniforms };
}

