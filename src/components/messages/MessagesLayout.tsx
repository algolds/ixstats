"use client";

import type { ReactNode } from "react";
import { cn } from "~/lib/utils";
import { CutoutCard } from "~/components/ui/cutout-card";

interface MessagesLayoutProps {
  conversationPanel: ReactNode;
  chatPanel: ReactNode;
  isSidebarCollapsed: boolean;
}

export function MessagesLayout({
  conversationPanel,
  chatPanel,
  isSidebarCollapsed,
}: MessagesLayoutProps) {
  return (
    <div className="relative grid h-[calc(100vh-8.5rem)] min-h-[500px] grid-cols-1 gap-5 lg:grid-cols-3">
      {/* Column 1: Conversation list panel (1/3 width on large screens) */}
      <CutoutCard
        variant="card"
        trackPointerHover={false}
        className={cn(
          "h-full min-w-0 cursor-default flex-col overflow-hidden lg:col-span-1",
          isSidebarCollapsed ? "hidden" : "flex"
        )}
      >
        {conversationPanel}
      </CutoutCard>

      {/* Column 2: Chat panel (2/3 width on large screens) */}
      <CutoutCard
        variant="card"
        trackPointerHover={false}
        className={cn(
          "h-full min-w-0 cursor-default flex-col overflow-hidden",
          isSidebarCollapsed ? "col-span-full flex lg:col-span-3" : "hidden lg:col-span-2 lg:flex"
        )}
      >
        {chatPanel}
      </CutoutCard>
    </div>
  );
}
