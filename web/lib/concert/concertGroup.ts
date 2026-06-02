import {
  ALL_CONCERT_SCENES,
  type ConcertScene,
} from "@/components/concert/ConcertVisualizer";
import type { PerformancePresetConcertSlice } from "@/lib/performancePreset";

export const CONCERT_GROUP_FORMAT = "neurovis-concert-group" as const;
export const CONCERT_GROUP_VERSION = 1 as const;
export const CONCERT_GROUPS_LS_KEY = "neurovis.concertGroups.v1" as const;

const SCENE_IDS = new Set<string>(ALL_CONCERT_SCENES.map((s) => s.id));

export type ConcertGroupV1 = {
  format: typeof CONCERT_GROUP_FORMAT;
  version: typeof CONCERT_GROUP_VERSION;
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  /** Ordered visualizer scenes for the show. */
  visualQueue: ConcertScene[];
  /** Ordered NIME patch ids (library: nime). */
  patchQueue: string[];
  /** Auto-advance during Play show (0 = manual only). */
  visualDwellSeconds: number;
  patchDwellSeconds: number;
  /** Optional defaults applied when the group is loaded (not full preset). */
  concertDefaults?: Partial<PerformancePresetConcertSlice>;
};

export type SavedConcertGroupMeta = {
  id: string;
  name: string;
  updatedAt: number;
  visualCount: number;
  patchCount: number;
};

function clampDwell(n: number): number {
  return Math.min(600, Math.max(0, Math.round(n)));
}

function filterScenes(ids: unknown): ConcertScene[] {
  if (!Array.isArray(ids)) return [];
  const out: ConcertScene[] = [];
  for (const id of ids) {
    if (typeof id === "string" && SCENE_IDS.has(id) && !out.includes(id as ConcertScene)) {
      out.push(id as ConcertScene);
    }
  }
  return out;
}

function filterPatchIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const out: string[] = [];
  for (const id of ids) {
    if (typeof id === "string" && id.trim() && !out.includes(id)) out.push(id);
  }
  return out;
}

export function createConcertGroup(input: {
  name: string;
  description?: string;
  visualQueue?: ConcertScene[];
  patchQueue?: string[];
  visualDwellSeconds?: number;
  patchDwellSeconds?: number;
  concertDefaults?: Partial<PerformancePresetConcertSlice>;
}): ConcertGroupV1 {
  const now = new Date().toISOString();
  return {
    format: CONCERT_GROUP_FORMAT,
    version: CONCERT_GROUP_VERSION,
    id: crypto.randomUUID(),
    name: input.name.trim() || "Untitled concert",
    description: input.description?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
    visualQueue: input.visualQueue ?? [],
    patchQueue: input.patchQueue ?? [],
    visualDwellSeconds: clampDwell(input.visualDwellSeconds ?? 0),
    patchDwellSeconds: clampDwell(input.patchDwellSeconds ?? 0),
    concertDefaults: input.concertDefaults,
  };
}

export function normalizeConcertGroup(raw: unknown): ConcertGroupV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.format !== CONCERT_GROUP_FORMAT) return null;
  if (Number(o.version) !== CONCERT_GROUP_VERSION) return null;
  const name = typeof o.name === "string" ? o.name.trim() : "";
  if (!name) return null;
  const id = typeof o.id === "string" && o.id ? o.id : crypto.randomUUID();
  const createdAt = typeof o.createdAt === "string" ? o.createdAt : new Date().toISOString();
  const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt : createdAt;
  return {
    format: CONCERT_GROUP_FORMAT,
    version: CONCERT_GROUP_VERSION,
    id,
    name,
    description: typeof o.description === "string" ? o.description.trim() || undefined : undefined,
    createdAt,
    updatedAt,
    visualQueue: filterScenes(o.visualQueue),
    patchQueue: filterPatchIds(o.patchQueue),
    visualDwellSeconds: clampDwell(Number(o.visualDwellSeconds ?? 0)),
    patchDwellSeconds: clampDwell(Number(o.patchDwellSeconds ?? 0)),
    concertDefaults:
      o.concertDefaults && typeof o.concertDefaults === "object"
        ? (o.concertDefaults as Partial<PerformancePresetConcertSlice>)
        : undefined,
  };
}

function readAll(): ConcertGroupV1[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CONCERT_GROUPS_LS_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    const out: ConcertGroupV1[] = [];
    for (const row of data) {
      const g = normalizeConcertGroup(row);
      if (g) out.push(g);
    }
    return out;
  } catch {
    return [];
  }
}

function writeAll(groups: ConcertGroupV1[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CONCERT_GROUPS_LS_KEY, JSON.stringify(groups));
  window.dispatchEvent(new Event("neurovis:concert-groups-changed"));
}

export function listConcertGroupMeta(): SavedConcertGroupMeta[] {
  return readAll()
    .map((g) => ({
      id: g.id,
      name: g.name,
      updatedAt: Date.parse(g.updatedAt) || 0,
      visualCount: g.visualQueue.length,
      patchCount: g.patchQueue.length,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function loadConcertGroup(id: string): ConcertGroupV1 | null {
  return readAll().find((g) => g.id === id) ?? null;
}

export function saveConcertGroup(group: ConcertGroupV1): ConcertGroupV1 {
  const next = { ...group, updatedAt: new Date().toISOString() };
  const all = readAll();
  const idx = all.findIndex((g) => g.id === next.id);
  if (idx >= 0) all[idx] = next;
  else all.push(next);
  writeAll(all);
  return next;
}

export function deleteConcertGroup(id: string) {
  writeAll(readAll().filter((g) => g.id !== id));
}

export function downloadConcertGroupJson(group: ConcertGroupV1) {
  const blob = new Blob([JSON.stringify(group, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safe = group.name.replace(/[^\w.-]+/g, "_").slice(0, 48) || "concert-group";
  a.href = url;
  a.download = `${safe}.concert-group.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function parseConcertGroupFile(json: unknown): ConcertGroupV1 | null {
  const g = normalizeConcertGroup(json);
  if (!g) return null;
  return { ...g, id: crypto.randomUUID(), updatedAt: new Date().toISOString() };
}
