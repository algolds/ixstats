"use client";

/**
 * WikiDIPlugin — registers a DI plugin for wiki pages.
 *
 * Renders the wiki breadcrumb/profile popover in the pill center
 * and exposes WikiView as the "wiki" expanded view.
 */

import React, { useMemo } from "react";
import { BookOpen } from "lucide-react";
import { useWikiContext } from "~/components/wikios/shared/WikiContext";
import { useDIPlugin } from "~/components/DynamicIsland/plugin-context";
import { WikiView } from "~/components/DynamicIsland/WikiView";
import { WikiProfileButton } from "~/components/DynamicIsland/WikiProfileButton";

function WikiBreadcrumb() {
  const { articleTitle, activeSectionId, tocEntries } = useWikiContext();
  const activeSectionName = activeSectionId
    ? (tocEntries.find((e) => e.id === activeSectionId)?.text ?? null)
    : null;

  return (
    <span className="flex max-w-[220px] items-center gap-1.5 overflow-hidden">
      <BookOpen className="h-3 w-3 shrink-0 text-blue-400 opacity-70" />
      <span className="di-wiki-title">
        <span className="di-wiki-title-text">
          {articleTitle || "IxWiki"}
        </span>
      </span>
      {activeSectionName && (
        <>
          <span className="text-foreground/25 shrink-0 text-[10px]">›</span>
          <span className="text-foreground/50 max-w-[80px] truncate text-[10px]">
            {activeSectionName}
          </span>
        </>
      )}
    </span>
  );
}

export function WikiDIPlugin() {
  const { articleTitle } = useWikiContext();

  const plugin = useMemo(
    () => ({
      id: "wiki",
      priority: 10,
      center: articleTitle ? <WikiBreadcrumb /> : <WikiProfileButton />,
      expandedViews: articleTitle ? { wiki: WikiView } : undefined,
      accentColor: "#3b82f6",
      stickyLabel: "Wiki",
    }),
    [articleTitle]
  );

  useDIPlugin(plugin);
  return null;
}
