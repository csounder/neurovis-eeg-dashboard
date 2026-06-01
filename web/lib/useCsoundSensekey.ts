"use client";

import * as React from "react";
import { wsSend } from "@/lib/useWebSocket";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) {
    return true;
  }
  if (target instanceof HTMLTextAreaElement) return true;
  return target.isContentEditable;
}

/**
 * Forward printable keys to the headless Csound process (sensekey) while a patch runs.
 * Concert scene hotkeys are disabled separately so 1–0, d/t/a/b reach the orchestra.
 */
export function useCsoundSensekeyForward(enabled: boolean) {
  React.useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      if (event.metaKey || event.ctrlKey) return;

      let text = "";
      if (event.key === "Enter") text = "\n";
      else if (event.key === "Backspace") text = "\u007f";
      else if (event.key.length === 1) text = event.key;
      else return;

      const sent = wsSend({ type: "csound_stdin", text });
      if (sent) event.preventDefault();
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [enabled]);
}
