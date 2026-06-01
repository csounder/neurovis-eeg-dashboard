"use client";

import * as React from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import {
  ScaleControl,
  TraceSpeedControl,
  type ScaleState,
} from "@/components/ui/ScaleControl";
import { cn } from "@/lib/utils";
import {
  DISPLAY_ORDER,
  DISPLAY_REGISTRY,
  type DisplayKind,
} from "@/lib/displays";

/**
 * A pane that lets the user pick a visualization from the registry, manage
 * its scale, and renders the chosen chart at the current pane size.
 */
export function DisplayPanel({
  kind,
  onKindChange,
  scale,
  onScaleChange,
  bodyHeight = 320,
  className,
  onMaximizeToggle,
  isMaximized = false,
}: {
  kind: DisplayKind;
  onKindChange: (next: DisplayKind) => void;
  scale: ScaleState;
  onScaleChange: (next: ScaleState) => void;
  bodyHeight?: number;
  className?: string;
  onMaximizeToggle?: () => void;
  isMaximized?: boolean;
}) {
  const spec = DISPLAY_REGISTRY[kind];
  const Icon = spec.icon;
  const [traceWindow, setTraceWindow] = React.useState(
    spec.defaultTraceWindow ?? 256,
  );

  React.useEffect(() => {
    setTraceWindow(spec.defaultTraceWindow ?? 256);
  }, [spec.defaultTraceWindow, kind]);

  return (
    <Card className={cn("flex h-full min-w-0 flex-col", className)}>
      <CardHeader className="items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-400">
            <Icon className="h-4 w-4" />
          </div>
          <KindPicker value={kind} onChange={onKindChange} />
        </div>
        {onMaximizeToggle && (
          <button
            onClick={onMaximizeToggle}
            className="ml-auto shrink-0 rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
            title={isMaximized ? "Restore" : "Expand pane"}
          >
            {isMaximized ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>
        )}
      </CardHeader>
      <CardBody className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <div className="min-h-0 flex-1">
          {spec.render({ height: bodyHeight, scale, traceWindow })}
        </div>
        {spec.scaleControl && (
          <ScaleControl
            compact
            state={scale}
            onChange={onScaleChange}
            label={spec.scaleControl.label}
            unit={spec.scaleControl.unit}
            bipolar={spec.scaleControl.bipolar}
            min={spec.scaleControl.min}
            max={spec.scaleControl.max}
            helpAuto={spec.scaleControl.helpAuto}
            helpManual={spec.scaleControl.helpManual}
          />
        )}
        {spec.defaultTraceWindow && (
          <TraceSpeedControl
            compact
            value={traceWindow}
            onChange={setTraceWindow}
          />
        )}
      </CardBody>
    </Card>
  );
}

/** Native <select> styled to match the theme — keeps a11y for free. */
function KindPicker({
  value,
  onChange,
}: {
  value: DisplayKind;
  onChange: (next: DisplayKind) => void;
}) {
  return (
    <div className="min-w-0 flex-1">
      <label className="sr-only" htmlFor="display-kind-picker">
        Visualization type
      </label>
      <select
        id="display-kind-picker"
        value={value}
        onChange={(e) => onChange(e.target.value as DisplayKind)}
        className="nv-select pr-8"
      >
        {DISPLAY_ORDER.map((k) => (
          <option key={k} value={k}>
            {DISPLAY_REGISTRY[k].label} — {DISPLAY_REGISTRY[k].description}
          </option>
        ))}
      </select>
    </div>
  );
}
