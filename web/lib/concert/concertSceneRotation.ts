import { ALL_CONCERT_SCENES, type ConcertScene } from "@/components/concert/ConcertVisualizer";

export const CONCERT_SCENE_ROTATION_LS_KEY = "neurovis.concertSceneRotation.v1" as const;

export type ConcertSceneRotationSettings = {
  enabled: boolean;
  /** Seconds between random scene changes (clamped). */
  intervalSeconds: number;
};

export const DEFAULT_CONCERT_SCENE_ROTATION: ConcertSceneRotationSettings = {
  enabled: false,
  intervalSeconds: 45,
};

const SCENE_IDS = ALL_CONCERT_SCENES.map((s) => s.id) as ConcertScene[];

function clampInterval(seconds: number): number {
  return Math.min(600, Math.max(8, Math.round(seconds)));
}

export function normalizeSceneRotation(raw: unknown): ConcertSceneRotationSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_CONCERT_SCENE_ROTATION };
  const o = raw as Record<string, unknown>;
  return {
    enabled: Boolean(o.enabled),
    intervalSeconds: clampInterval(Number(o.intervalSeconds ?? DEFAULT_CONCERT_SCENE_ROTATION.intervalSeconds)),
  };
}

export function readConcertSceneRotation(): ConcertSceneRotationSettings {
  if (typeof window === "undefined") return { ...DEFAULT_CONCERT_SCENE_ROTATION };
  try {
    const raw = window.localStorage.getItem(CONCERT_SCENE_ROTATION_LS_KEY);
    if (!raw) return { ...DEFAULT_CONCERT_SCENE_ROTATION };
    return normalizeSceneRotation(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_CONCERT_SCENE_ROTATION };
  }
}

export function writeConcertSceneRotation(settings: ConcertSceneRotationSettings): void {
  if (typeof window === "undefined") return;
  const normalized = normalizeSceneRotation(settings);
  window.localStorage.setItem(CONCERT_SCENE_ROTATION_LS_KEY, JSON.stringify(normalized));
}

/** Pick a random scene different from `current` when possible. */
export function pickRandomConcertScene(current: ConcertScene): ConcertScene {
  if (SCENE_IDS.length <= 1) return current;
  let next = current;
  for (let i = 0; i < 8 && next === current; i += 1) {
    next = SCENE_IDS[Math.floor(Math.random() * SCENE_IDS.length)] ?? current;
  }
  return next;
}
