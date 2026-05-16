"use client";

import type { ReactNode } from "react";
import { cn } from "~/lib/utils";

interface MessagesLayoutProps {
  folderNav: ReactNode;
  conversationPanel: ReactNode;
  chatPanel: ReactNode;
  folderNavExpanded: boolean;
}

export function MessagesLayout({
  folderNav,
  conversationPanel,
  chatPanel,
  folderNavExpanded,
}: MessagesLayoutProps) {
  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden rounded-xl border border-border shadow-sm">
      {/* Column 1: Folder nav rail / sidebar */}
      <div
        className={cn(
          "glass-hierarchy-parent shrink-0 z-10 border-r border-border/50 bg-background/80 backdrop-blur-md transition-[width] duration-200 ease-in-out",
          folderNavExpanded ? "w-48" : "w-14"
        )}
      >
        {folderNav}
      </div>

      {/* Column 2: Conversation list panel */}
      <div className="glass-hierarchy-child w-80 shrink-0 border-r border-border/50 bg-background/60 backdrop-blur-md xl:w-96">
        {conversationPanel}
      </div>

      {/* Column 3: Chat panel */}
      <div className="glass-hierarchy-child min-w-0 flex-1 bg-background/40 backdrop-blur-sm">
        {chatPanel}
      </div>
    </div>
  );
}
