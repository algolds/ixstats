"use client";

import type { ReactNode } from "react";
import { cn } from "~/lib/utils";
import { CutoutCard } from "~/components/ui/cutout-card";

interface ThinktankLayoutProps {
  directoryPanel: ReactNode;
  workspacePanel: ReactNode;
  isSidebarCollapsed: boolean;
}

export function ThinktankLayout({
  directoryPanel,
  workspacePanel,
  isSidebarCollapsed,
}: ThinktankLayoutProps) {
  return (
    <div className="relative grid h-[calc(100vh-8.5rem)] min-h-[500px] grid-cols-1 gap-5 lg:grid-cols-3">
      {/* Column 1: Directory list panel (1/3 width on large screens) */}
      <CutoutCard
        variant="card"
        trackPointerHover={false}
        className={cn(
          "h-full min-w-0 cursor-default flex-col overflow-hidden lg:col-span-1",
          isSidebarCollapsed ? "hidden" : "flex"
        )}
      >
        {directoryPanel}
      </CutoutCard>

      {/* Column 2: Workspace panel (2/3 width on large screens) */}
      <CutoutCard
        variant="card"
        trackPointerHover={false}
        className={cn(
          "h-full min-w-0 cursor-default flex-col overflow-hidden",
          isSidebarCollapsed ? "col-span-full flex lg:col-span-3" : "hidden lg:col-span-2 lg:flex"
        )}
      >
        {workspacePanel}
      </CutoutCard>
    </div>
  );
}
