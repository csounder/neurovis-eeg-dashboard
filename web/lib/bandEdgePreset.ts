/**
 * Global preset for EEG band integration edges (δ–γ).
 * Drives the browser band-pass trace bank, and syncs to the Node bridge for
 * Welch / FFT band-power bins (Csound, Concert, REST /api/bands, Stimulus).
 */

import type { BandEdgeProfile } from "./bandFilters";
import type { BandEdgePreset } from "./types";

export type { BandEdgePreset };

export const BAND_EDGE_LS_KEY = "neurovis.bandEdgePreset";

export const BAND_EDGE_PRESET_OPTIONS: {
  id: BandEdgePreset;
  label: string;
  summary: string;
}[] = [
  {
    id: "neurovis",
    label: "NeuroVis default",
    summary:
      "δ 1–4 Hz (aligned with common research highpass); θ–γ unchanged. Relative band share uses integrated power per band.",
  },
  {
    id: "research_dc",
    label: "Research · stricter δ",
    summary:
      "δ 1–4 Hz; θ–γ unchanged. Welch edges match NeuroVis default after δ alignment.",
  },
  {
    id: "mindmonitor",
    label: "Mind Monitor (full)",
    summary:
      "All bands match Mind Monitor manual (α 7.5–13 Hz, γ 30–44 Hz, …). Use when matching Mind Monitor OSC/exports.",
  },
];

export function coerceBandEdgePreset(v: unknown): BandEdgePreset {
  if (v === "research_dc" || v === "mindmonitor" || v === "neurovis") return v;
  return "neurovis";
}

/** Same string union as `BandEdgeProfile` — use with `bandFilters.setEdgeProfile`. */
export function presetToBandEdgeProfile(preset: BandEdgePreset): BandEdgeProfile {
  return preset;
}
