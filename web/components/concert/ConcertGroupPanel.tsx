"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronUp,
  Download,
  ListOrdered,
  Play,
  Plus,
  Save,
  Square,
  Trash2,
  Upload,
} from "lucide-react";
import { concertSceneSpec, type ConcertScene } from "@/components/concert/ConcertVisualizer";
import type { ConcertNimePatchPanelHandle } from "@/components/concert/ConcertNimePatchPanel";
import {
  createConcertGroup,
  deleteConcertGroup,
  downloadConcertGroupJson,
  listConcertGroupMeta,
  loadConcertGroup,
  parseConcertGroupFile,
  saveConcertGroup,
  type ConcertGroupV1,
  type SavedConcertGroupMeta,
} from "@/lib/concert/concertGroup";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";

export function ConcertGroupPanel({
  scene,
  onSceneChange,
  visualQueue,
  onVisualQueueChange,
  patchQueue,
  onPatchQueueChange,
  showActive,
  visualQueueIndex,
  patchQueueIndex,
  visualDwell,
  onVisualDwellChange,
  patchDwell,
  onPatchDwellChange,
  onPlayShow,
  onStopShow,
  onStepVisualQueue,
  onStepPatchQueue,
  nimeRef,
}: {
  scene: ConcertScene;
  onSceneChange: (s: ConcertScene) => void;
  visualQueue: ConcertScene[];
  onVisualQueueChange: (q: ConcertScene[]) => void;
  patchQueue: string[];
  onPatchQueueChange: (q: string[]) => void;
  showActive: boolean;
  visualQueueIndex: number;
  patchQueueIndex: number;
  visualDwell: number;
  onVisualDwellChange: (n: number) => void;
  patchDwell: number;
  onPatchDwellChange: (n: number) => void;
  onPlayShow: () => void;
  onStopShow: () => void;
  onStepVisualQueue: (delta: -1 | 1) => void;
  onStepPatchQueue: (delta: -1 | 1) => void;
  nimeRef: React.RefObject<ConcertNimePatchPanelHandle | null>;
}) {
  const [saved, setSaved] = React.useState<SavedConcertGroupMeta[]>([]);
  const [activeGroupId, setActiveGroupId] = React.useState<string | null>(null);
  const [groupName, setGroupName] = React.useState("My concert");
  const fileRef = React.useRef<HTMLInputElement>(null);

  const refreshSaved = React.useCallback(() => {
    setSaved(listConcertGroupMeta());
  }, []);

  React.useEffect(() => {
    refreshSaved();
    const onChange = () => refreshSaved();
    window.addEventListener("neurovis:concert-groups-changed", onChange);
    return () => window.removeEventListener("neurovis:concert-groups-changed", onChange);
  }, [refreshSaved]);

  const patchList = nimeRef.current?.getPatchList() ?? [];
  const patchName = (id: string) => patchList.find((p) => p.id === id)?.name ?? id;

  const addVisual = () => {
    if (visualQueue.includes(scene)) return;
    onVisualQueueChange([...visualQueue, scene]);
  };

  const addPatch = () => {
    const id = nimeRef.current?.getSelectedId() ?? "";
    if (!id || patchQueue.includes(id)) return;
    onPatchQueueChange([...patchQueue, id]);
  };

  const moveItem = <T,>(arr: T[], index: number, delta: -1 | 1): T[] => {
    const next = arr.slice();
    const to = index + delta;
    if (to < 0 || to >= next.length) return next;
    const tmp = next[index]!;
    next[index] = next[to]!;
    next[to] = tmp;
    return next;
  };

  const saveCurrentGroup = () => {
    const existing = activeGroupId ? loadConcertGroup(activeGroupId) : null;
    const group: ConcertGroupV1 = existing
      ? {
          ...existing,
          name: groupName.trim() || existing.name,
          visualQueue,
          patchQueue,
          visualDwellSeconds: visualDwell,
          patchDwellSeconds: patchDwell,
        }
      : createConcertGroup({
          name: groupName,
          visualQueue,
          patchQueue,
          visualDwellSeconds: visualDwell,
          patchDwellSeconds: patchDwell,
        });
    const savedGroup = saveConcertGroup(group);
    setActiveGroupId(savedGroup.id);
    refreshSaved();
  };

  const loadGroup = (id: string) => {
    const g = loadConcertGroup(id);
    if (!g) return;
    setActiveGroupId(g.id);
    setGroupName(g.name);
    onVisualQueueChange(g.visualQueue);
    onPatchQueueChange(g.patchQueue);
    onVisualDwellChange(g.visualDwellSeconds);
    onPatchDwellChange(g.patchDwellSeconds);
    if (g.visualQueue[0]) onSceneChange(g.visualQueue[0]);
    if (g.patchQueue[0]) {
      nimeRef.current?.setSelectedId(g.patchQueue[0]);
    }
  };

  const importFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const g = parseConcertGroupFile(JSON.parse(String(reader.result ?? "")));
        if (!g) return;
        const savedGroup = saveConcertGroup(g);
        loadGroup(savedGroup.id);
      } catch {
        /* ignore */
      }
    };
    reader.readAsText(file);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle
          icon={<ListOrdered className="h-4 w-4" />}
          description="Build ordered visualizer and NIME patch lists, save as a concert group, and play through the show."
          actions={
            showActive ? (
              <Badge tone="emerald" dot>
                Show live
              </Badge>
            ) : null
          }
        >
          Concert group (show queue)
        </CardTitle>
      </CardHeader>
      <CardBody className="space-y-5">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-xs text-zinc-400">
            Group name
            <input
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
          </label>
          <Button size="sm" leftIcon={<Save className="h-4 w-4" />} onClick={saveCurrentGroup}>
            Save group
          </Button>
          <Button
            size="sm"
            variant="outline"
            leftIcon={<Download className="h-4 w-4" />}
            onClick={() => {
              const g = activeGroupId
                ? loadConcertGroup(activeGroupId)
                : createConcertGroup({ name: groupName, visualQueue, patchQueue });
              if (g) downloadConcertGroupJson(g);
            }}
          >
            Export JSON
          </Button>
          <Button
            size="sm"
            variant="outline"
            leftIcon={<Upload className="h-4 w-4" />}
            onClick={() => fileRef.current?.click()}
          >
            Import
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importFile(f);
              e.target.value = "";
            }}
          />
        </div>

        {saved.length > 0 && (
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            Load saved group
            <select
              className="nv-select"
              value={activeGroupId ?? ""}
              onChange={(e) => {
                const id = e.target.value;
                if (id) loadGroup(id);
                else setActiveGroupId(null);
              }}
            >
              <option value="">— select —</option>
              {saved.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.visualCount} vis · {m.patchCount} patches)
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <QueueColumn
            title="Visualizer queue"
            count={visualQueue.length}
            onAdd={addVisual}
            addLabel="Add current scene"
            dwell={visualDwell}
            onDwellChange={onVisualDwellChange}
          >
            {visualQueue.length === 0 ? (
              <p className="text-xs text-zinc-500">No scenes queued.</p>
            ) : (
              visualQueue.map((id, i) => (
                <QueueRow
                  key={`${id}-${i}`}
                  label={concertSceneSpec(id)?.title ?? id}
                  highlight={showActive && i === visualQueueIndex}
                  onUp={() => onVisualQueueChange(moveItem(visualQueue, i, -1))}
                  onDown={() => onVisualQueueChange(moveItem(visualQueue, i, 1))}
                  onRemove={() => onVisualQueueChange(visualQueue.filter((_, j) => j !== i))}
                  onGo={() => onSceneChange(id)}
                />
              ))
            )}
          </QueueColumn>

          <QueueColumn
            title="NIME patch queue"
            count={patchQueue.length}
            onAdd={addPatch}
            addLabel="Add current patch"
            dwell={patchDwell}
            onDwellChange={onPatchDwellChange}
          >
            {patchQueue.length === 0 ? (
              <p className="text-xs text-zinc-500">No patches queued.</p>
            ) : (
              patchQueue.map((id, i) => (
                <QueueRow
                  key={`${id}-${i}`}
                  label={patchName(id)}
                  highlight={showActive && i === patchQueueIndex}
                  onUp={() => onPatchQueueChange(moveItem(patchQueue, i, -1))}
                  onDown={() => onPatchQueueChange(moveItem(patchQueue, i, 1))}
                  onRemove={() => onPatchQueueChange(patchQueue.filter((_, j) => j !== i))}
                  onGo={() => {
                    nimeRef.current?.setSelectedId(id);
                    void nimeRef.current?.launchPatchId(id);
                  }}
                />
              ))
            )}
          </QueueColumn>
        </div>

        <div className="flex flex-wrap gap-2">
          {!showActive ? (
            <Button variant="primary" leftIcon={<Play className="h-4 w-4" />} onClick={onPlayShow}>
              Play show
            </Button>
          ) : (
            <Button variant="outline" leftIcon={<Square className="h-4 w-4" />} onClick={onStopShow}>
              Stop show
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => onStepVisualQueue(-1)}>
            Prev visual
          </Button>
          <Button variant="outline" size="sm" onClick={() => onStepVisualQueue(1)}>
            Next visual
          </Button>
          <Button variant="outline" size="sm" onClick={() => onStepPatchQueue(-1)}>
            Prev patch
          </Button>
          <Button variant="outline" size="sm" onClick={() => onStepPatchQueue(1)}>
            Next patch
          </Button>
        </div>

        <p className="text-[11px] leading-5 text-zinc-500">
          During <strong className="text-zinc-400">Play show</strong>, ↑↓ and ←→ step within the queues (not the full
          library). Set dwell seconds &gt; 0 to auto-advance visuals and/or patches. Arrow keys still work when show is
          off.
        </p>

        {activeGroupId && (
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Trash2 className="h-4 w-4" />}
            onClick={() => {
              deleteConcertGroup(activeGroupId);
              setActiveGroupId(null);
              refreshSaved();
            }}
          >
            Delete saved group
          </Button>
        )}
      </CardBody>
    </Card>
  );
}

function QueueColumn({
  title,
  count,
  children,
  onAdd,
  addLabel,
  dwell,
  onDwellChange,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  onAdd: () => void;
  addLabel: string;
  dwell: number;
  onDwellChange: (n: number) => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-zinc-300">
          {title} ({count})
        </span>
        <Button size="sm" variant="outline" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={onAdd}>
          {addLabel}
        </Button>
      </div>
      <label className="flex items-center gap-2 text-[11px] text-zinc-500">
        Auto-advance (s, 0=off)
        <input
          type="number"
          min={0}
          max={600}
          className="w-16 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200"
          value={dwell}
          onChange={(e) => onDwellChange(Number(e.target.value) || 0)}
        />
      </label>
      <div className="max-h-48 space-y-1 overflow-y-auto">{children}</div>
    </div>
  );
}

function QueueRow({
  label,
  highlight,
  onUp,
  onDown,
  onRemove,
  onGo,
}: {
  label: string;
  highlight?: boolean;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
  onGo: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs ${
        highlight ? "border-emerald-500/60 bg-emerald-500/10 text-zinc-100" : "border-zinc-800 text-zinc-300"
      }`}
    >
      <button type="button" className="min-w-0 flex-1 truncate text-left hover:text-emerald-300" onClick={onGo}>
        {label}
      </button>
      <button type="button" className="text-zinc-500 hover:text-zinc-200" onClick={onUp} aria-label="Move up">
        <ChevronUp className="h-3.5 w-3.5" />
      </button>
      <button type="button" className="text-zinc-500 hover:text-zinc-200" onClick={onDown} aria-label="Move down">
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      <button type="button" className="text-zinc-500 hover:text-rose-300" onClick={onRemove} aria-label="Remove">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
