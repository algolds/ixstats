"use client";

import { cn } from "~/lib/utils";
import React from "react";
import Link from "next/link";
import { User, EditPencil as PenTool, Calendar } from "iconoir-react";
import { CategoryBreadcrumb } from "../CategoryBreadcrumb";
import { withBasePath } from "~/lib/base-path";
import type { ArticleHeaderProps } from "../ArticleHeader";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { WatchButton } from "../WatchButton";

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
    <header className="wikios-editorial-masthead border-separator relative mb-8 border-b pt-2 pb-6 select-none">
      {/* Subtle Ambient Radial Aura */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-12 left-0 -z-10 h-44 w-96 rounded-full opacity-20 blur-3xl"
        style={{
          background: `radial-gradient(circle, ${themeColors?.primary ?? "#3b82f6"} 0%, transparent 70%)`,
        }}
      />

      {/* Top Bar: Breadcrumb */}
      <div className="text-label-secondary text-eyebrow mb-4 flex items-center gap-1">
        <CategoryBreadcrumb title={title} />
      </div>

      {/* Main Title Display */}
      <div className="mb-4 flex flex-wrap items-baseline gap-3">
        <h1 className="text-large-title text-label lg:text-display">{title.replace(/_/g, " ")}</h1>
        <WatchButton title={title} wikiSource={wikiSource} />
      </div>

      {/* Metadata & Awards Ledger */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 pt-1">
        <div className="text-label-secondary text-footnote flex flex-wrap items-center gap-x-4 gap-y-2">
          {/* Author Attribution */}
          {creatorName && (
            <div className="flex items-center gap-2 font-medium">
              <span className="text-label-secondary text-footnote font-normal">Author:</span>
              <Link
                href={withBasePath(
                  `/wiki/User:${encodeURIComponent(creatorName.replace(/ /g, "_"))}`
                )}
                className="group/author text-label border-separator text-caption hover:border-tint/40 hover:bg-tint/10 hover:text-tint inline-flex items-center gap-2 rounded-full border bg-black/5 px-3 py-0.5 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform]"
              >
                {creatorAvatar ? (
                  <span className="relative flex size-4 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10">
                    <img
                      src={creatorAvatar}
                      alt={creatorName}
                      className="aspect-square size-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = "none";
                      }}
                    />
                    <User className="text-tint absolute inset-0 -z-10 m-auto h-2.5 w-2.5" />
                  </span>
                ) : (
                  <User className="text-tint h-3 w-3 shrink-0" />
                )}
                <span>{creatorName}</span>
              </Link>
            </div>
          )}

          {/* Most Recent Editor */}
          {lastEditorName &&
            creatorName &&
            lastEditorName.toLowerCase() !== creatorName.toLowerCase() && (
              <div className="flex items-center gap-2 font-medium">
                <span className="text-label-secondary select-none">•</span>
                <span className="text-label-secondary text-footnote font-normal">Updated by:</span>
                <Link
                  href={withBasePath(
                    `/wiki/User:${encodeURIComponent(lastEditorName.replace(/ /g, "_"))}`
                  )}
                  className="group/editor text-label border-separator text-caption hover:border-tint/40 hover:bg-tint/10 hover:text-tint inline-flex items-center gap-2 rounded-full border bg-black/5 px-3 py-0.5 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform]"
                >
                  {lastEditorAvatar ? (
                    <span className="relative flex size-4 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10">
                      <img
                        src={lastEditorAvatar}
                        alt={lastEditorName}
                        className="aspect-square size-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = "none";
                        }}
                      />
                      <PenTool className="text-tint absolute inset-0 -z-10 m-auto h-2.5 w-2.5" />
                    </span>
                  ) : (
                    <PenTool className="text-tint h-3 w-3 shrink-0" />
                  )}
                  <span>{lastEditorName}</span>
                </Link>
              </div>
            )}

          {/* Updated Timestamp */}
          {lastModified && (
            <div className="text-label-secondary text-footnote flex items-center gap-2">
              {(creatorName || lastEditorName) && (
                <span className="text-label-secondary select-none">•</span>
              )}
              <span className="flex items-center gap-2">
                <Calendar className="text-label-secondary h-3.5 w-3.5" />
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
                className={cn(
                  "group text-caption duration-fast relative flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 transition-[background-color,border-color,transform]",
                  badgeConfig.classes,
                  showCelebration &&
                    primaryAward.category === "LOREWARD" &&
                    "loreward-badge-celebrate"
                )}
              >
                {showCelebration && primaryAward.category === "LOREWARD" && (
                  <div className="pointer-events-none absolute inset-0 overflow-visible">
                    {[...Array(8)].map((_, i) => (
                      <span key={i} className={`loreward-particle loreward-particle-${i + 1}`} />
                    ))}
                  </div>
                )}
                <badgeConfig.Icon className={cn("size-3.5 shrink-0", badgeConfig.iconColor)} />
                {awardsData.awards.length > 1 && (
                  <span className="text-caption leading-none font-semibold tabular-nums opacity-80">
                    +{awardsData.awards.length - 1}
                  </span>
                )}
                <span>{badgeConfig.text}</span>
              </button>
            </PopoverTrigger>

            <PopoverContent
              side="bottom"
              align="end"
              sideOffset={8}
              className="text-footnote w-72 space-y-2 p-4"
            >
              <div className="text-label-secondary text-eyebrow text-left">
                Article distinctions
              </div>
              <div className="space-y-2">
                {awardsData.awards.map((award) => (
                  <div
                    key={award.id}
                    className="border-separator space-y-0.5 border-b pb-2 last:border-0 last:pb-0"
                  >
                    <div className="text-label font-semibold">{award.name}</div>
                    {award.description && (
                      <p className="text-label-secondary text-footnote leading-relaxed">
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
