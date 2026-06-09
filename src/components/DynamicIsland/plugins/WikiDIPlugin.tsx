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
import { WikiProfileView } from "~/components/DynamicIsland/WikiProfileView";
import { PreText } from "~/components/ui/pretext";
import { cn } from "~/lib/utils";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";

function getRgbaColor(colorStr: string, opacity: number): string {
  if (colorStr.startsWith("#")) {
    const cleanHex = colorStr.replace("#", "");
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  if (colorStr.startsWith("hsl")) {
    return colorStr.replace("hsl(", "hsla(").replace(")", `, ${opacity})`);
  }
  return `rgba(59, 130, 246, ${opacity})`;
}

function WikiBreadcrumb() {
  const { articleTitle, activeSectionId, tocEntries, navigateToSection, themeColors } = useWikiContext();
  const [popoverOpen, setPopoverOpen] = useState(false);

  const activeSectionName = activeSectionId
    ? (tocEntries.find((e) => e.id === activeSectionId)?.text ?? null)
    : null;

  return (
    <span
      className={cn(
        "flex w-full items-center gap-1.5 overflow-hidden transition-all duration-300",
        activeSectionName ? "max-w-[260px] min-w-[200px]" : "max-w-[200px] min-w-[140px]"
      )}
    >
      <span
        className={cn(
          "di-wiki-title flex-1 transition-all duration-300",
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
                  className="hover:text-foreground relative z-[60] inline-block max-w-[110px] min-w-[60px] flex-1 cursor-pointer overflow-hidden rounded px-1 py-0.5 text-left transition-all duration-200 hover:bg-white/20 active:scale-95"
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
              className="w-56 rounded-xl border border-white/10 bg-zinc-950/95 p-1.5 backdrop-blur-xl dark:bg-black/90"
            >
              <div className="max-h-[200px] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent space-y-0.5 overflow-y-auto select-none">
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
                          "flex w-full cursor-pointer items-center rounded-lg px-2.5 py-1.5 text-left text-[11px] font-semibold transition-all duration-150 select-none",
                          isActive && !themeColors
                            ? "bg-white/15 text-white"
                            : isActive
                              ? ""
                              : "text-muted-foreground hover:text-foreground hover:bg-white/5",
                          entry.level === 3 ? "pl-5" : ""
                        )}
                        style={
                          isActive && themeColors
                            ? {
                                color: themeColors.primary,
                                backgroundColor: getRgbaColor(themeColors.primary, 0.08),
                              }
                            : {}
                        }
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
      expandedViews: (articleTitle ? { wiki: WikiView } : { profile: WikiProfileView }) as Record<
        string,
        React.ComponentType<any>
      >,
      accentColor: "#3b82f6",
      stickyLabel: "Wiki",
    }),
    [articleTitle]
  );

  useDIPlugin(plugin);
  return null;
}
