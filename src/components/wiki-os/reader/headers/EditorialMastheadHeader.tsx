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
  // oxlint-disable-next-line eslint/no-unused-vars
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
  const creatorName =
    typeof creator === "object"
      ? (creator as any)?.username
      : creator || (authorInfo as any)?.author || null;
  const creatorAvatar = authorInfo?.creatorAvatar || null;
  const lastEditor = authorInfo?.lastEditor;
  const lastEditorName =
    typeof lastEditor === "object" ? (lastEditor as any)?.username : lastEditor || null;
  const lastEditorAvatar = authorInfo?.lastEditorAvatar || null;

  return (
    <header className="wikios-editorial-masthead border-border/40 relative mb-8 border-b pt-2 pb-6 select-none">
      {/* Subtle Ambient Radial Aura */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-12 left-0 -z-10 h-44 w-96 rounded-full opacity-20 blur-3xl"
        style={{
          background: `radial-gradient(circle, ${themeColors?.primary ?? "#3b82f6"} 0%, transparent 70%)`,
        }}
      />

      {/* Top Bar: Breadcrumb */}
      <div className="text-muted-foreground mb-3.5 flex items-center gap-1 text-[10.5px] font-semibold tracking-wider uppercase">
        <CategoryBreadcrumb title={title} />
      </div>

      {/* Main Title Display */}
      <div className="mb-4 flex flex-wrap items-baseline gap-3">
        <h1 className="text-foreground font-['Host_Grotesk'] text-3xl leading-[1.15] font-bold tracking-tight sm:text-4xl lg:text-[42px]">
          {title.replace(/_/g, " ")}
        </h1>
      </div>

      {/* Metadata & Awards Ledger */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 pt-1">
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-3.5 gap-y-2 text-[12px]">
          {/* Author Attribution */}
          {creatorName && (
            <div className="flex items-center gap-1.5 font-medium">
              <span className="text-muted-foreground/75 text-[11px] font-normal">Author:</span>
              <Link
                href={withBasePath(
                  `/wiki/User:${encodeURIComponent(creatorName.replace(/ /g, "_"))}`
                )}
                className="group/author text-foreground inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-black/5 px-2.5 py-0.5 text-[11.5px] font-semibold transition-all hover:border-purple-500/40 hover:bg-purple-500/10 hover:text-purple-300 active:scale-95 dark:border-white/10 dark:bg-white/5"
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
                    <User className="absolute inset-0 -z-10 m-auto h-2.5 w-2.5 text-purple-400" />
                  </span>
                ) : (
                  <User className="h-3 w-3 shrink-0 text-purple-400" />
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
                <span className="text-muted-foreground/75 text-[11px] font-normal">
                  Updated by:
                </span>
                <Link
                  href={withBasePath(
                    `/wiki/User:${encodeURIComponent(lastEditorName.replace(/ /g, "_"))}`
                  )}
                  className="group/editor text-foreground inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-black/5 px-2.5 py-0.5 text-[11.5px] font-semibold transition-all hover:border-purple-500/40 hover:bg-purple-500/10 hover:text-purple-300 active:scale-95 dark:border-white/10 dark:bg-white/5"
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
                      <PenTool className="absolute inset-0 -z-10 m-auto h-2.5 w-2.5 text-purple-400" />
                    </span>
                  ) : (
                    <PenTool className="h-3 w-3 shrink-0 text-purple-400" />
                  )}
                  <span>{lastEditorName}</span>
                </Link>
              </div>
            )}

          {/* Updated Timestamp */}
          {lastModified && (
            <div className="text-muted-foreground/80 flex items-center gap-1.5 text-[11px]">
              {(creatorName || lastEditorName) && (
                <span className="text-muted-foreground/30 select-none">•</span>
              )}
              <span className="flex items-center gap-1.5">
                <Calendar className="text-muted-foreground/60 h-3.5 w-3.5" />
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
                      <span key={i} className={`loreward-particle loreward-particle-${i + 1}`} />
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
                  <div
                    key={award.id}
                    className="space-y-0.5 border-b border-black/5 pb-2 last:border-0 last:pb-0 dark:border-white/5"
                  >
                    <div className="text-foreground font-semibold">{award.name}</div>
                    {award.description && (
                      <p className="text-muted-foreground text-[11px] leading-relaxed">
                        {award.description}
                      </p>
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
