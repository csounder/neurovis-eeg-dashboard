/**
 * Browser @csound/browser can need a few event-loop turns after Csound() resolves
 * before compile/start sees a fully wired WASM + Web Audio backend (desktop-style “wait until ready”).
 */

export async function yieldCsoundInstanceReady(): Promise<void> {
  await Promise.resolve();
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
}

export async function yieldAfterOrchestraCompiled(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
}

/** After csound.start(); give the realtime driver a beat before rewiring getNode(). */
export async function yieldAfterCsoundStart(): Promise<void> {
  await new Promise((r) => setTimeout(r, 120));
}
