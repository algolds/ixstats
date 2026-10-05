"use client";

import type { ReactNode } from "react";
import { Card } from "~/components/ui/card";
import { Inspector } from "~/components/ui/inspector";

interface ThinktankLayoutProps {
  directoryPanel: ReactNode;
  workspacePanel: ReactNode;
  /** Whether the directory sheet is open; the directory is a column at 1280px and wider. */
  directoryOpen: boolean;
  onDirectoryOpenChange: (open: boolean) => void;
}

const PANEL_HEIGHT = "h-[calc(100vh-8.5rem)] min-h-[500px]";

/** The open group, with the directory of ThinkTanks beside it in an Inspector. */
export function ThinktankLayout({
  directoryPanel,
  workspacePanel,
  directoryOpen,
  onDirectoryOpenChange,
}: ThinktankLayoutProps) {
  return (
    <div className="flex gap-5 lg:gap-6">
      <Card className={`flex min-w-0 flex-1 flex-col overflow-hidden ${PANEL_HEIGHT}`}>
        {workspacePanel}
      </Card>

      <Inspector title="ThinkTanks" open={directoryOpen} onOpenChange={onDirectoryOpenChange}>
        <Card className={`flex flex-col overflow-hidden ${PANEL_HEIGHT}`}>{directoryPanel}</Card>
      </Inspector>
    </div>
  );
}
