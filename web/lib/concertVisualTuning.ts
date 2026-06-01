/** Sliders for Concert stage — classic EEG, WebGL, and animation drive. */
export type ConcertVisualTuning = {
  /** Scales band + channel energy (0.25–3). */
  eegSensitivity: number;
  /** Element size multiplier on top of stage intensity (0.5–2). */
  visualScale: number;
  /** Global draw opacity / luminance for 2D canvas scenes (0.35–2). */
  brightness: number;
  /** How much live EEG vs neutral fallback shapes classic visuals (0–1). */
  eegInfluence: number;
  /** AR scenes: 0 = EEG envelope only, 1 = audio tap only (mic/WASM per mode). */
  arAudioMix: number;
  /** WebGL output luminance (0.35–2.5). */
  glBrightness: number;
  /** WebGL shader + TF flow speed multiplier (0.4–2.5). */
  glMotion: number;
  /** WebGL TF particles / filament emphasis (0.5–2). */
  glParticleGlow: number;
  /** Global animation speed — higher = more active (0.25–2.5, 1 = default). */
  motionActivity: number;
};

export const DEFAULT_CONCERT_VISUAL_TUNING: ConcertVisualTuning = {
  eegSensitivity: 1,
  visualScale: 1,
  brightness: 1,
  eegInfluence: 1,
  arAudioMix: 0.5,
  glBrightness: 1,
  glMotion: 1,
  glParticleGlow: 1,
  motionActivity: 1,
};

export function clampTuning(t: ConcertVisualTuning): ConcertVisualTuning {
  return {
    eegSensitivity: clamp(t.eegSensitivity, 0.25, 3),
    visualScale: clamp(t.visualScale, 0.5, 2),
    brightness: clamp(t.brightness, 0.35, 2),
    eegInfluence: clamp(t.eegInfluence, 0, 1),
    arAudioMix: clamp(t.arAudioMix, 0, 1),
    glBrightness: clamp(t.glBrightness, 0.35, 2.5),
    glMotion: clamp(t.glMotion, 0.4, 2.5),
    glParticleGlow: clamp(t.glParticleGlow, 0.5, 2),
    motionActivity: clamp(t.motionActivity, 0.25, 2.5),
  };
}

/** Merge saved presets that predate WebGL / motion sliders. */
export function mergeConcertVisualTuning(
  partial: Partial<ConcertVisualTuning> | null | undefined,
): ConcertVisualTuning {
  return clampTuning({ ...DEFAULT_CONCERT_VISUAL_TUNING, ...partial });
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
