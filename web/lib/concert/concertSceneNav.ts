import { ALL_CONCERT_SCENES, type ConcertScene } from "@/components/concert/ConcertVisualizer";

const ORDERED_SCENE_IDS = ALL_CONCERT_SCENES.map((s) => s.id) as ConcertScene[];

/** Step to previous (−1) or next (+1) visualizer in concert picker order. */
export function stepConcertScene(current: ConcertScene, delta: -1 | 1): ConcertScene {
  if (ORDERED_SCENE_IDS.length === 0) return current;
  const idx = ORDERED_SCENE_IDS.indexOf(current);
  const from = idx >= 0 ? idx : 0;
  const next =
    (from + delta + ORDERED_SCENE_IDS.length) % ORDERED_SCENE_IDS.length;
  return ORDERED_SCENE_IDS[next] ?? current;
}
