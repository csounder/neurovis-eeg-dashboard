"use client";

import * as React from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { MindMonitorSync } from "./MindMonitorSync";
import { bandFilters } from "@/lib/bandFilters";
import { presetToBandEdgeProfile } from "@/lib/bandEdgePreset";
import { useNeuroStore } from "@/lib/store";
import { useNeuroVisSocket } from "@/lib/useWebSocket";

function syncNvSkinDom(skin: "studio" | "sand" | "copper" | "olive" | "slate") {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-nv-skin", skin);
  document.body?.setAttribute("data-nv-skin", skin);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  // Opens the WebSocket once for the whole app tree.
  useNeuroVisSocket();

  const bandEdgePreset = useNeuroStore((s) => s.bandEdgePreset);
  const uiSkin = useNeuroStore((s) => s.uiSkin);

  React.useEffect(() => {
    useNeuroStore.getState().hydrateEegTraceSourceFromStorage();
    useNeuroStore.getState().hydrateBandEdgePresetFromStorage();
    useNeuroStore.getState().hydrateUiSkinFromStorage();
    syncNvSkinDom(useNeuroStore.getState().uiSkin);
  }, []);

  React.useEffect(() => {
    bandFilters.setEdgeProfile(presetToBandEdgeProfile(bandEdgePreset));
  }, [bandEdgePreset]);

  React.useLayoutEffect(() => {
    syncNvSkinDom(uiSkin);
  }, [uiSkin]);

  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <div className="relative mx-auto flex min-h-screen max-w-[1600px]">
      <MindMonitorSync />
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenMenu={() => setMobileOpen(true)} />
        <main className="flex-1 px-4 pb-16 pt-6 sm:px-6 lg:px-8">
          <div className="animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
