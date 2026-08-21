"use client";

import type { ReactNode } from "react";
import { cn } from "~/lib/utils";
import { CutoutCard, cutoutCardSurfaceClassName } from "~/components/ui/cutout-card";

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
        className={cn(
          cutoutCardSurfaceClassName,
          "relative z-10 flex h-full min-w-0 cursor-default flex-col overflow-hidden rounded-2xl border border-border/50 bg-card/60 shadow-xl backdrop-blur-xl transition-all duration-300 dark:border-white/10 dark:bg-white/[0.03] lg:col-span-1",
          isSidebarCollapsed ? "hidden" : "flex"
        )}
        trackPointerHover={false}
        texture="paperGrain"
        textureOpacity={0.08}
      >
        {conversationPanel}
      </CutoutCard>

      {/* Column 2: Chat panel (2/3 width on large screens) */}
      <CutoutCard
        className={cn(
          cutoutCardSurfaceClassName,
          "relative z-10 flex h-full min-w-0 cursor-default flex-col overflow-hidden rounded-2xl border border-border/50 bg-card/60 shadow-xl backdrop-blur-xl transition-all duration-300 dark:border-white/10 dark:bg-white/[0.03]",
          isSidebarCollapsed ? "col-span-full lg:col-span-3" : "hidden lg:col-span-2 lg:flex"
        )}
        trackPointerHover={false}
        texture="diagonal"
        textureOpacity={0.06}
      >
        {chatPanel}
      </CutoutCard>
    </div>
  );
}
