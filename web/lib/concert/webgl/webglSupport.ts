export type WebGL2Probe = {
  ok: boolean;
  message: string;
  renderer: string;
  isSoftwareRenderer: boolean;
};

/** Try several context attribute sets (helps when GPU prefs block WebGL2). */
export function createWebGL2Context(canvas: HTMLCanvasElement): WebGL2RenderingContext | null {
  const attempts: WebGLContextAttributes[] = [
    {
      alpha: false,
      antialias: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
      failIfMajorPerformanceCaveat: false,
    },
    {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: "default",
      failIfMajorPerformanceCaveat: false,
    },
    {
      alpha: true,
      antialias: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      failIfMajorPerformanceCaveat: false,
    },
  ];
  for (const attrs of attempts) {
    const gl = canvas.getContext("webgl2", attrs);
    if (gl) return gl;
  }
  return null;
}

export function probeWebGL2(): WebGL2Probe {
  if (typeof document === "undefined") {
    return { ok: false, message: "WebGL probe unavailable during SSR.", renderer: "", isSoftwareRenderer: false };
  }
  const canvas = document.createElement("canvas");
  const gl = createWebGL2Context(canvas);
  if (!gl) {
    const gl1 = canvas.getContext("webgl") ?? canvas.getContext("experimental-webgl");
    if (!gl1) {
      return {
        ok: false,
        message:
          "This browser did not create a WebGL context. Enable hardware acceleration in your browser settings, or open NeuroVis in Chrome or Safari (not an embedded preview pane).",
        renderer: "",
        isSoftwareRenderer: false,
      };
    }
    return {
      ok: false,
      message: "Only WebGL 1 is available; NeuroVis concert shaders require WebGL 2.",
      renderer: "",
      isSoftwareRenderer: false,
    };
  }
  const ext = gl.getExtension("WEBGL_debug_renderer_info");
  const renderer =
    ext != null
      ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? "")
      : String(gl.getParameter(gl.RENDERER) ?? "");
  const soft = /swiftshader|llvmpipe|software|microsoft basic render/i.test(renderer);
  return {
    ok: true,
    message: soft
      ? `WebGL2 is using a software renderer (${renderer || "unknown"}). Scenes may be slow but should run.`
      : "WebGL2 OK",
    renderer,
    isSoftwareRenderer: soft,
  };
}

export function webglFailureHint(error: string): string {
  const e = error.toLowerCase();
  if (e.includes("not available") || e.includes("did not create") || e.includes("webgl 1")) {
    return "Chrome: Settings → System → “Use graphics acceleration when available”. Safari: Settings → Advanced → “Use hardware acceleration”. Then restart the browser.";
  }
  if (e.includes("shader") || e.includes("compile") || e.includes("link")) {
    return "This is usually a shader bug on your GPU, not missing hardware acceleration. Try another WebGL scene or report the error text above.";
  }
  if (e.includes("software renderer")) {
    return "Software WebGL is enabled; scenes should still run. For better performance, enable GPU acceleration and reload.";
  }
  return "Try another scene from the picker, reload the page, or use Chrome with GPU acceleration enabled.";
}
