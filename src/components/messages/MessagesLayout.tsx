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
    <div className="border-border flex h-[calc(100vh-4rem)] overflow-hidden rounded-xl border shadow-sm">
      {/* Column 1: Folder nav rail / sidebar */}
      <div
        className={cn(
          "glass-hierarchy-parent border-border/50 bg-background/80 z-10 shrink-0 border-r backdrop-blur-md transition-[width] duration-200 ease-in-out",
          folderNavExpanded ? "w-48" : "w-14"
        )}
      >
        {folderNav}
      </div>

      {/* Column 2: Conversation list panel */}
      <div className="glass-hierarchy-child border-border/50 bg-background/60 w-80 shrink-0 border-r backdrop-blur-md xl:w-96">
        {conversationPanel}
      </div>

      {/* Column 3: Chat panel */}
      <div className="glass-hierarchy-child bg-background/40 min-w-0 flex-1 backdrop-blur-sm">
        {chatPanel}
      </div>
    </div>
  );
}
