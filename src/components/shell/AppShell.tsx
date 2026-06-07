"use client";

import { TopBar } from "./TopBar";
import { LeftToolbar } from "./LeftToolbar";
import { RightInspector } from "./RightInspector";
import { BottomGallery } from "./BottomGallery";
import { TldrawCanvas } from "@/components/canvas/TldrawCanvas";
import { ApiSettingsDialog } from "@/components/settings/ApiSettingsDialog";

export function AppShell() {
  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "var(--background)" }}>
      <TopBar />
      <div className="flex-1 flex overflow-hidden relative">
        <LeftToolbar />
        <TldrawCanvas />
        <RightInspector />
      </div>
      <BottomGallery />
      <ApiSettingsDialog />
    </div>
  );
}
