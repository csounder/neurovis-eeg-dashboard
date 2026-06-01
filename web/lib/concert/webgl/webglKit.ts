export type WebGLProgramBundle = {
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
};

function shader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error("WebGL: createShader failed");
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh) || "unknown";
    gl.deleteShader(sh);
    throw new Error(`WebGL shader compile failed: ${log}`);
  }
  return sh;
}

export function linkProgram(gl: WebGL2RenderingContext, vsSrc: string, fsSrc: string): WebGLProgramBundle {
  const vs = shader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = shader(gl, gl.FRAGMENT_SHADER, fsSrc);
  const program = gl.createProgram();
  if (!program) throw new Error("WebGL: createProgram failed");
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) || "unknown";
    gl.deleteProgram(program);
    throw new Error(`WebGL link failed: ${log}`);
  }
  return { program, uniforms: {} };
}

export function getUniforms(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  names: string[],
): Record<string, WebGLUniformLocation | null> {
  const out: Record<string, WebGLUniformLocation | null> = {};
  for (const name of names) out[name] = gl.getUniformLocation(program, name);
  return out;
}

export function makeFloatTexture1D(gl: WebGL2RenderingContext, width: number): WebGLTexture {
  const tex = gl.createTexture();
  if (!tex) throw new Error("WebGL: createTexture failed");
  gl.bindTexture(gl.TEXTURE_2D, tex);
  // Float linear filtering can be extension-dependent; NEAREST is always safe.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, 1, 0, gl.RGBA, gl.FLOAT, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
}

export function updateFloatTexture1D(
  gl: WebGL2RenderingContext,
  tex: WebGLTexture,
  width: number,
  rgba: Float32Array,
) {
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, 1, gl.RGBA, gl.FLOAT, rgba);
  gl.bindTexture(gl.TEXTURE_2D, null);
}

export type PingPong = {
  aTex: WebGLTexture;
  bTex: WebGLTexture;
  aFbo: WebGLFramebuffer;
  bFbo: WebGLFramebuffer;
  w: number;
  h: number;
  format: "rgba16f" | "rgba8";
  swap: () => void;
  /** current render target */
  writeFbo: () => WebGLFramebuffer;
  /** previous frame texture */
  readTex: () => WebGLTexture;
};

function allocColorTex(gl: WebGL2RenderingContext, w: number, h: number, format: "rgba16f" | "rgba8"): WebGLTexture {
  const tex = gl.createTexture();
  if (!tex) throw new Error("WebGL: createTexture failed");
  gl.bindTexture(gl.TEXTURE_2D, tex);
  // NEAREST keeps the feedback buffer crisp (LINEAR reads look like \"out of focus TV\").
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  if (format === "rgba16f") {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
  } else {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  }
  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
}

function makeFbo(gl: WebGL2RenderingContext, tex: WebGLTexture): WebGLFramebuffer {
  const fbo = gl.createFramebuffer();
  if (!fbo) throw new Error("WebGL: createFramebuffer failed");
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return fbo;
}

export function makePingPong(gl: WebGL2RenderingContext, w: number, h: number): PingPong {
  // Try float feedback buffers, fall back to RGBA8 if not renderable.
  const hasFloatColor = Boolean(gl.getExtension("EXT_color_buffer_float"));
  const preferred: "rgba16f" | "rgba8" = hasFloatColor ? "rgba16f" : "rgba8";

  const tryMake = (format: "rgba16f" | "rgba8") => {
    const aTex = allocColorTex(gl, w, h, format);
    const bTex = allocColorTex(gl, w, h, format);
    const aFbo = makeFbo(gl, aTex);
    const bFbo = makeFbo(gl, bTex);
    gl.bindFramebuffer(gl.FRAMEBUFFER, aFbo);
    const aStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, bFbo);
    const bStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const ok = aStatus === gl.FRAMEBUFFER_COMPLETE && bStatus === gl.FRAMEBUFFER_COMPLETE;
    return { ok, aTex, bTex, aFbo, bFbo };
  };

  let made = tryMake(preferred);
  if (!made.ok && preferred !== "rgba8") {
    // Clean up and retry with RGBA8.
    gl.deleteFramebuffer(made.aFbo);
    gl.deleteFramebuffer(made.bFbo);
    gl.deleteTexture(made.aTex);
    gl.deleteTexture(made.bTex);
    made = tryMake("rgba8");
  }

  if (!made.ok) {
    // Hard error: even RGBA8 FBO is not renderable (extremely rare).
    gl.deleteFramebuffer(made.aFbo);
    gl.deleteFramebuffer(made.bFbo);
    gl.deleteTexture(made.aTex);
    gl.deleteTexture(made.bTex);
    throw new Error("WebGL: framebuffer incomplete (RGBA8 not renderable).");
  }

  let flip = false;
  return {
    aTex: made.aTex,
    bTex: made.bTex,
    aFbo: made.aFbo,
    bFbo: made.bFbo,
    w,
    h,
    format: preferred,
    swap: () => {
      flip = !flip;
    },
    writeFbo: () => (flip ? made.bFbo : made.aFbo),
    readTex: () => (flip ? made.aTex : made.bTex),
  };
}

export function resizePingPong(gl: WebGL2RenderingContext, pp: PingPong, w: number, h: number) {
  pp.w = w;
  pp.h = h;
  for (const tex of [pp.aTex, pp.bTex]) {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (pp.format === "rgba16f") {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }
  }
  gl.bindTexture(gl.TEXTURE_2D, null);
}

