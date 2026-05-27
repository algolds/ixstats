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
    <div className="border-border flex h-[calc(100vh-4rem)] rounded-xl border shadow-sm">
      {/* Column 1: Folder nav rail / sidebar — overflow-visible so tooltips escape */}
      <div
        className={cn(
          "border-border/50 bg-background/95 relative z-20 shrink-0 overflow-visible rounded-l-xl border-r transition-[width] duration-200 ease-in-out",
          folderNavExpanded ? "w-48" : "w-14"
        )}
      >
        {folderNav}
      </div>

      {/* Column 2: Conversation list panel — no backdrop-filter to avoid blurring nav tooltips */}
      <div className="border-border/50 bg-background/90 z-10 w-80 shrink-0 overflow-hidden border-r xl:w-96">
        {conversationPanel}
      </div>

      {/* Column 3: Chat panel */}
      <div className="bg-background/80 min-w-0 flex-1 overflow-hidden rounded-r-xl backdrop-blur-sm">
        {chatPanel}
      </div>
    </div>
  );
}
