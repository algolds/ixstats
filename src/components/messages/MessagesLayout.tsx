"use client";

import type { ReactNode } from "react";
import { Card } from "~/components/ui/card";
import { cn } from "~/lib/utils";

interface MessagesLayoutProps {
  /** The inbox: folder bar, search, filters and the conversation list. */
  rail: ReactNode;
  /** The open thread, or the empty state when none is selected. */
  thread: ReactNode;
  /** A thread is selected: below 1024px the thread replaces the inbox. */
  hasThread: boolean;
}

/**
 * One pane holding the inbox rail and the thread. From 1024px both stay on screen with a hairline between them;
 * below that only one shows, the inbox until a thread is selected. Its height is the window minus Halo's band and the
 * tab bar, so the page itself never scrolls and each side scrolls on its own.
 */
export function MessagesLayout({ rail, thread, hasThread }: MessagesLayoutProps) {
  return (
    <Card
      content="feed"
      className="h-[calc(100dvh-var(--shell-top-offset)-var(--shell-tabbar-height)-1rem)] min-h-112 grid-cols-1 overflow-clip lg:grid lg:grid-cols-[22rem_minmax(0,1fr)]"
    >
      <section
        aria-label="Conversations"
        className={cn(
          "border-separator min-h-0 min-w-0 flex-col lg:flex lg:h-full lg:border-r",
          hasThread ? "hidden" : "flex h-full"
        )}
      >
        {rail}
      </section>
      <section
        aria-label="Thread"
        className={cn(
          "min-h-0 min-w-0 flex-col lg:flex lg:h-full",
          hasThread ? "flex h-full" : "hidden"
        )}
      >
        {thread}
      </section>
    </Card>
  );
}
