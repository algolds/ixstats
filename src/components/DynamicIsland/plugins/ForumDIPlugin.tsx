"use client";

/**
 * ForumDIPlugin — registers a DI plugin for forum pages.
 *
 * Shows the current forum/thread breadcrumb in the pill center
 * and exposes ForumView as the "forum" expanded view.
 */

import React, { useMemo } from "react";
import { MessageSquare } from "lucide-react";
import { useForumContext } from "~/components/forum/shared/ForumContext";
import { useDIPlugin } from "~/components/DynamicIsland/plugin-context";
import { ForumView } from "~/components/DynamicIsland/ForumView";

function ForumBreadcrumb() {
  const { currentThread, currentForum, unreadAlerts } = useForumContext();

  const label = currentThread?.title ?? currentForum?.title ?? "Forum";

  return (
    <span className="flex max-w-[200px] items-center gap-1.5 overflow-hidden">
      <MessageSquare className="h-3 w-3 shrink-0 text-orange-400 opacity-70" />
      <span className="text-foreground/80 truncate text-xs font-medium">{label}</span>
      {unreadAlerts > 0 && (
        <span className="flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-orange-500 px-1 text-[8px] font-bold text-white">
          {unreadAlerts}
        </span>
      )}
    </span>
  );
}

export function ForumDIPlugin() {
  const { unreadAlerts } = useForumContext();

  const plugin = useMemo(
    () => ({
      id: "forum",
      priority: 10,
      center: <ForumBreadcrumb />,
      expandedViews: { forum: ForumView },
      accentColor: "#f97316",
      stickyLabel: "Forum",
      badge: unreadAlerts > 0 ? { color: "#f97316", pulse: true } : undefined,
    }),
    [unreadAlerts]
  );

  useDIPlugin(plugin);
  return null;
}
