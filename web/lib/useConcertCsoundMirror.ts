"use client";

import { useMemo } from "react";
import { buildConcertCsoundMirror } from "@/lib/concertCsoundMirror";
import { useNeuroStore } from "@/lib/store";

export function useConcertCsoundMirror() {
  const lines = useNeuroStore((s) => s.csoundConsoleLines);
  return useMemo(() => buildConcertCsoundMirror(lines), [lines]);
}
