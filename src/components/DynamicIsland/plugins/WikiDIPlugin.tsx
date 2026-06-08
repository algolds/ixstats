"use client";

/**
 * WikiDIPlugin — registers a DI plugin for wiki pages.
 *
 * Renders the wiki breadcrumb/profile popover in the pill center
 * and exposes WikiView as the "wiki" expanded view.
 */

import React, { useMemo, useState } from "react";
import { useWikiContext } from "~/components/wikios/shared/WikiContext";
import { useDIPlugin } from "~/components/DynamicIsland/plugin-context";
import { WikiView } from "~/components/DynamicIsland/WikiView";
import { WikiProfileButton } from "~/components/DynamicIsland/WikiProfileButton";
import { PreText } from "~/components/ui/pretext";
import { cn } from "~/lib/utils";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";

function WikiBreadcrumb() {
  const { articleTitle, activeSectionId, tocEntries, navigateToSection } = useWikiContext();
  const [popoverOpen, setPopoverOpen] = useState(false);

  const activeSectionName = activeSectionId
    ? (tocEntries.find((e) => e.id === activeSectionId)?.text ?? null)
    : null;

  return (
    <span
      className={cn(
        "flex items-center gap-1.5 overflow-hidden transition-all duration-300 w-full",
        activeSectionName ? "max-w-[260px] min-w-[200px]" : "max-w-[200px] min-w-[140px]"
      )}
    >
      <span
        className={cn(
          "di-wiki-title transition-all duration-300 flex-1",
          activeSectionName ? "max-w-[120px] min-w-[100px]" : "max-w-[180px] min-w-[140px]"
        )}
      >
        <PreText
          className="di-wiki-title-text"
          whiteSpace="normal"
          font="500 14px Inter, sans-serif"
          lineHeight={16}
        >
          {articleTitle || "IxWiki"}
        </PreText>
      </span>
      {activeSectionName && (
        <>
          <span className="text-foreground/25 shrink-0 text-[10px]">›</span>
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger
              nativeButton={false}
              render={
                <span
                  className="max-w-[110px] min-w-[60px] overflow-hidden flex-1 text-left hover:text-foreground hover:bg-white/20 px-1 py-0.5 rounded transition-all duration-200 cursor-pointer active:scale-95 relative z-[60] inline-block"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPopoverOpen((prev) => !prev);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                >
                  <PreText
                    className="text-foreground/50 text-[10px] font-medium"
                    whiteSpace="nowrap"
                  >
                    {activeSectionName}
                  </PreText>
                </span>
              }
            />
            <PopoverContent
              side="bottom"
              align="start"
              sideOffset={8}
              className="w-56 p-1.5 bg-zinc-950/95 dark:bg-black/90 border border-white/10 backdrop-blur-xl rounded-xl"
            >
              <div className="max-h-[200px] overflow-y-auto space-y-0.5 select-none scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {tocEntries
                  .filter((e) => e.level <= 3)
                  .map((entry) => {
                    const isActive = activeSectionId === entry.id;
                    return (
                      <button
                        key={entry.id}
                        onClick={() => {
                          navigateToSection(entry.id);
                          setPopoverOpen(false);
                        }}
                        className={cn(
                          "w-full text-left flex items-center py-1.5 px-2.5 rounded-lg text-[11px] font-semibold transition-all duration-150 cursor-pointer select-none",
                          isActive
                            ? "bg-white/15 text-white"
                            : "text-muted-foreground hover:text-foreground hover:bg-white/5",
                          entry.level === 3 ? "pl-5" : ""
                        )}
                        type="button"
                      >
                        {entry.level === 3 && (
                          <span className="text-muted-foreground/60 mr-1 text-[9px]">›</span>
                        )}
                        <span className="truncate">{entry.text}</span>
                      </button>
                    );
                  })}
              </div>
            </PopoverContent>
          </Popover>
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
