"use client";

import React from "react";
import Link from "next/link";
import { User, EditPencil as PenTool, Calendar } from "iconoir-react";
import { CategoryBreadcrumb } from "../CategoryBreadcrumb";
import { withBasePath } from "~/lib/base-path";
import type { ArticleHeaderProps } from "../ArticleHeader";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";

interface EditorialMastheadProps extends ArticleHeaderProps {
  primaryAward: any;
  badgeConfig: any;
  showCelebration: boolean;
  showPopover: boolean;
  setShowPopover: (show: boolean) => void;
}

export function EditorialMastheadHeader({
  title,
  lastModified,
  wikiSource,
  themeColors,
  authorInfo,
  awardsData,
  primaryAward,
  badgeConfig,
  showCelebration,
  showPopover,
  setShowPopover,
}: EditorialMastheadProps) {
  const creator = authorInfo?.creator;
  const creatorName = typeof creator === "object" ? (creator as any)?.username : (creator || (authorInfo as any)?.author || null);
  const creatorAvatar = authorInfo?.creatorAvatar || null;
  const lastEditor = authorInfo?.lastEditor;
  const lastEditorName = typeof lastEditor === "object" ? (lastEditor as any)?.username : (lastEditor || null);
  const lastEditorAvatar = authorInfo?.lastEditorAvatar || null;

  return (
    <header className="wikios-editorial-masthead relative mb-8 border-b border-border/40 pb-6 pt-2 select-none">
      {/* Subtle Ambient Radial Aura */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-12 left-0 h-44 w-96 rounded-full opacity-20 blur-3xl -z-10"
        style={{
          background: `radial-gradient(circle, ${themeColors?.primary ?? "#3b82f6"} 0%, transparent 70%)`,
        }}
      />

      {/* Top Bar: Breadcrumb */}
      <div className="mb-3.5 flex items-center gap-1 text-muted-foreground text-[10.5px] font-semibold tracking-wider uppercase">
        <CategoryBreadcrumb title={title} />
      </div>

      {/* Main Title Display */}
      <div className="mb-4 flex flex-wrap items-baseline gap-3">
        <h1 className="font-['Host_Grotesk'] text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-[42px] leading-[1.15]">
          {title.replace(/_/g, " ")}
        </h1>
      </div>

      {/* Metadata & Awards Ledger */}
      <div className="flex flex-wrap items-center justify-between gap-y-3 gap-x-4 pt-1">
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-3.5 gap-y-2 text-[12px]">
          {/* Author Attribution */}
          {creatorName && (
            <div className="flex items-center gap-1.5 font-medium">
              <span className="text-[11px] text-muted-foreground/75 font-normal">Author:</span>
              <Link
                href={withBasePath(`/wiki/User:${encodeURIComponent(creatorName.replace(/ /g, "_"))}`)}
                className="group/author inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-foreground font-semibold hover:border-purple-500/40 hover:bg-purple-500/10 hover:text-purple-300 active:scale-95 transition-all text-[11.5px]"
              >
                {creatorAvatar ? (
                  <span className="relative flex size-4 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10 dark:ring-white/20">
                    <img
                      src={creatorAvatar}
                      alt={creatorName}
                      className="aspect-square size-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = "none";
                      }}
                    />
                    <User className="h-2.5 w-2.5 text-purple-400 absolute inset-0 m-auto -z-10" />
                  </span>
                ) : (
                  <User className="h-3 w-3 text-purple-400 shrink-0" />
                )}
                <span>{creatorName}</span>
              </Link>
            </div>
          )}

          {/* Most Recent Editor */}
          {lastEditorName &&
            creatorName &&
            lastEditorName.toLowerCase() !== creatorName.toLowerCase() && (
              <div className="flex items-center gap-1.5 font-medium">
                <span className="text-muted-foreground/30 select-none">•</span>
                <span className="text-[11px] text-muted-foreground/75 font-normal">Updated by:</span>
                <Link
                  href={withBasePath(`/wiki/User:${encodeURIComponent(lastEditorName.replace(/ /g, "_"))}`)}
                  className="group/editor inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-foreground font-semibold hover:border-purple-500/40 hover:bg-purple-500/10 hover:text-purple-300 active:scale-95 transition-all text-[11.5px]"
                >
                  {lastEditorAvatar ? (
                    <span className="relative flex size-4 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10 dark:ring-white/20">
                      <img
                        src={lastEditorAvatar}
                        alt={lastEditorName}
                        className="aspect-square size-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = "none";
                        }}
                      />
                      <PenTool className="h-2.5 w-2.5 text-purple-400 absolute inset-0 m-auto -z-10" />
                    </span>
                  ) : (
                    <PenTool className="h-3 w-3 text-purple-400 shrink-0" />
                  )}
                  <span>{lastEditorName}</span>
                </Link>
              </div>
            )}

          {/* Updated Timestamp */}
          {lastModified && (
            <div className="flex items-center gap-1.5 text-muted-foreground/80 text-[11px]">
              {(creatorName || lastEditorName) && (
                <span className="text-muted-foreground/30 select-none">•</span>
              )}
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground/60" />
                {new Date(lastModified).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
          )}
        </div>

        {/* Awards Badge */}
        {awardsData?.hasAwards && primaryAward && badgeConfig && (
          <Popover open={showPopover} onOpenChange={setShowPopover}>
            <PopoverTrigger asChild>
              <button
                className={`group relative flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1 text-[10.5px] font-bold shadow-sm transition-all duration-300 hover:shadow-md active:scale-95 ${
                  badgeConfig.classes
                } ${
                  showCelebration && primaryAward.category === "LOREWARD"
                    ? "loreward-badge-celebrate"
                    : ""
                }`}
              >
                {showCelebration && primaryAward.category === "LOREWARD" && (
                  <div className="pointer-events-none absolute inset-0 overflow-visible">
                    {[...Array(8)].map((_, i) => (
                      <span
                        key={i}
                        className={`loreward-particle loreward-particle-${i + 1}`}
                      />
                    ))}
                  </div>
                )}
                <badgeConfig.Icon
                  className={`h-3.5 w-3.5 shrink-0 group-hover:animate-bounce ${badgeConfig.iconColor}`}
                />
                {awardsData.awards.length > 1 && (
                  <span className="text-[10.5px] leading-none font-bold tabular-nums opacity-80">
                    +{awardsData.awards.length - 1}
                  </span>
                )}
                <span className="tracking-wider uppercase">{badgeConfig.text}</span>
              </button>
            </PopoverTrigger>

            <PopoverContent
              side="bottom"
              align="end"
              sideOffset={8}
              className="z-[100055] w-72 space-y-2.5 rounded-xl border border-zinc-200 bg-white/95 p-3.5 text-xs shadow-2xl backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/90"
            >
              <div className="text-muted-foreground text-left text-[9px] font-semibold tracking-wider uppercase">
                Article Distinctions
              </div>
              <div className="space-y-2">
                {awardsData.awards.map((award) => (
                  <div key={award.id} className="space-y-0.5 border-b border-black/5 dark:border-white/5 pb-2 last:border-0 last:pb-0">
                    <div className="font-semibold text-foreground">{award.name}</div>
                    {award.description && (
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{award.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </header>
  );
}
