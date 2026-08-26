// src/components/wiki-os/reader/ArticleCompanionHUD.tsx
// Apple-inspired companion rail widget positioned in the right margin under the TOC.
// Features reading metrics, audio narration toggle, Margin discussion count, and quick actions.

"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import {
  Clock,
  Link as LinkIcon,
  ChatBubble,
  Trophy,
  Pause,
  Play,
  Group as Users,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { soundEffects } from "~/lib/sound/cuelume";
import { withBasePath } from "~/lib/base-path";
import { StashButton } from "./StashButton";
import type { ArticleAuthorInfo } from "./ArticleHeader";

interface ArticleCompanionHUDProps {
  title: string;
  slug?: string;
  contentHtml: string;
  lastModified?: string | null;
  authorInfo?: ArticleAuthorInfo | null;
  categories?: string[];
  awardsData?: any;
  marginThreadsCount?: number;
  marginAnnotationsCount?: number;
  onOpenMargin?: (tab?: "threads" | "markup") => void;
  onOpenHistory?: () => void;
  onOpenBacklinks?: () => void;
  narrator?: {
    isPlaying: boolean;
    play: () => void;
    pause: () => void;
    stop: () => void;
  };
  isAuthenticated?: boolean;
  isCollapsed?: boolean;
}

export function ArticleCompanionHUD({
  title,
  slug: _slug,
  contentHtml,
  lastModified,
  authorInfo,
  categories = [],
  awardsData,
  marginThreadsCount = 0,
  marginAnnotationsCount = 0,
  onOpenMargin,
  onOpenHistory,
  onOpenBacklinks,
  narrator,
  isAuthenticated = false,
  isCollapsed = false,
}: ArticleCompanionHUDProps) {
  if (isCollapsed) return null;

  const [showAllContributors, setShowAllContributors] = React.useState(false);

  // Calculate word count & estimated reading time dynamically
  const { wordCount, readingTime } = useMemo(() => {
    if (!contentHtml) return { wordCount: 0, readingTime: 1 };
    const plainText = contentHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const words = plainText ? plainText.split(/\s+/).length : 0;
    const time = Math.max(1, Math.ceil(words / 200));
    return { wordCount: words, readingTime: time };
  }, [contentHtml]);

  const creator = authorInfo?.creator;
  const creatorName =
    typeof creator === "object"
      ? (creator as any)?.username
      : (creator || (authorInfo as any)?.author || null);

  const createdAt =
    authorInfo?.createdAt ||
    (typeof creator === "object" ? (creator as any)?.timestamp : null) ||
    (authorInfo as any)?.createdTimestamp ||
    null;

  const lastEditor = authorInfo?.lastEditor;
  const lastEditorName =
    typeof lastEditor === "object"
      ? (lastEditor as any)?.username
      : (lastEditor || null);

  const effectiveLastModified =
    lastModified ||
    authorInfo?.lastEditedAt ||
    (typeof lastEditor === "object" ? (lastEditor as any)?.timestamp : null) ||
    null;

  const rawContributors = authorInfo?.contributors || [];
  const otherContributors = useMemo(() => {
    return rawContributors.filter(
      (c) => c.username && (!creatorName || c.username.toLowerCase() !== creatorName.toLowerCase())
    );
  }, [rawContributors, creatorName]);

  const totalContributorsCount =
    authorInfo?.totalContributors ||
    (otherContributors.length + (creatorName ? 1 : 0));

  const hasNotes = marginThreadsCount > 0 || marginAnnotationsCount > 0;

  return (
    <div className="wikios-companion-hud flex flex-col gap-3 pt-3 select-none">
      {/* 1. Article Intelligence & Provenance Capsule */}
      <div className="facet-surface rounded-2xl border border-white/10 bg-card/40 p-3.5 shadow-xs backdrop-blur-xl transition-all duration-300">
        <div className="flex items-center justify-between gap-2 border-b border-border/30 pb-2 mb-2.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 font-brand">
            Article Intel
          </span>
          {awardsData?.hasLoreward && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 text-[9px] font-bold text-amber-400">
              <Trophy className="h-2.5 w-2.5" />
              Awarded
            </span>
          )}
        </div>

        <div className="space-y-2 text-xs text-muted-foreground font-ui">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground/70">Read Time</span>
            <span className="font-semibold text-foreground tabular-nums">~{readingTime} min</span>
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground/70">Length</span>
            <span className="font-semibold text-foreground tabular-nums">{wordCount.toLocaleString()} words</span>
          </div>

          {/* Original Creator / Author */}
          {creatorName && (
            <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-border/20">
              <span className="text-muted-foreground/70">Created by</span>
              <Link
                href={withBasePath(`/wiki/User:${encodeURIComponent(creatorName.replace(/ /g, "_"))}`)}
                className="font-semibold text-foreground hover:text-purple-400 truncate max-w-[120px] transition-colors"
                title={`Original Author: ${creatorName}`}
              >
                {creatorName}
              </Link>
            </div>
          )}

          {/* Creation Date */}
          {createdAt && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground/70">Created</span>
              <span className="font-medium text-foreground/80 tabular-nums text-[10.5px]">
                {new Date(createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
          )}

          {/* Last Updated Timestamp */}
          {effectiveLastModified && (
            <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-border/20">
              <span className="text-muted-foreground/70">Last Updated</span>
              <span className="font-medium text-foreground/90 tabular-nums text-[10.5px]">
                {new Date(effectiveLastModified).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
          )}

          {/* Last Editor (if distinct) */}
          {lastEditorName && lastEditorName.toLowerCase() !== creatorName?.toLowerCase() && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground/70">Last Editor</span>
              <Link
                href={withBasePath(`/wiki/User:${encodeURIComponent(lastEditorName.replace(/ /g, "_"))}`)}
                className="font-medium text-foreground/90 hover:text-purple-400 truncate max-w-[120px] transition-colors"
                title={`Last edited by ${lastEditorName}`}
              >
                {lastEditorName}
              </Link>
            </div>
          )}

          {/* Other Contributors Section */}
          {otherContributors.length > 0 && (
            <div className="pt-2 border-t border-border/20 space-y-1.5">
              <div className="flex items-center justify-between text-[10.5px]">
                <span className="text-muted-foreground/80 font-medium flex items-center gap-1">
                  <Users className="h-3 w-3 text-cyan-400" />
                  Contributors
                </span>
                <span className="text-[10px] font-bold text-muted-foreground/70 tabular-nums">
                  {totalContributorsCount}
                </span>
              </div>

              <div className="flex flex-wrap gap-1 pt-0.5">
                {(showAllContributors ? otherContributors : otherContributors.slice(0, 3)).map((contrib) => (
                  <Link
                    key={contrib.username}
                    href={withBasePath(`/wiki/User:${encodeURIComponent(contrib.username.replace(/ /g, "_"))}`)}
                    className="inline-flex items-center gap-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 px-1.5 py-0.5 text-[10px] font-medium text-foreground/90 hover:text-cyan-300 transition-colors truncate max-w-[140px]"
                    title={`${contrib.username} (${contrib.editCount || 1} edits)`}
                  >
                    <span>{contrib.username}</span>
                    {contrib.editCount && contrib.editCount > 1 && (
                      <span className="text-[8.5px] text-muted-foreground/70 tabular-nums">
                        ({contrib.editCount})
                      </span>
                    )}
                  </Link>
                ))}

                {otherContributors.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setShowAllContributors((v) => !v)}
                    className="text-[9.5px] font-semibold text-cyan-400 hover:text-cyan-300 px-1 py-0.5 cursor-pointer transition-colors"
                  >
                    {showAllContributors ? "Show less" : `+${otherContributors.length - 3} more`}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Quick Actions Glass Control Center */}
      <div className="facet-surface rounded-2xl border border-white/10 bg-card/40 p-2.5 shadow-xs backdrop-blur-xl space-y-1.5">
        {/* Listen / Voice Narrator Toggle */}
        {narrator && (
          <button
            type="button"
            onClick={() => {
              soundEffects.bloom();
              if (narrator.isPlaying) {
                narrator.pause();
              } else {
                narrator.play();
              }
            }}
            className={cn(
              "group flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-xs font-semibold transition-all duration-200 cursor-pointer active:scale-[0.97]",
              narrator.isPlaying
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-xs"
                : "bg-white/5 hover:bg-white/10 text-foreground border border-white/5"
            )}
          >
            <div className="flex items-center gap-2">
              {narrator.isPlaying ? (
                <Pause className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
              ) : (
                <Play className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
              )}
              <span>{narrator.isPlaying ? "Narrating..." : "Listen to article"}</span>
            </div>
            {narrator.isPlaying && (
              <span className="flex items-center gap-0.5">
                <span className="h-2 w-0.5 animate-[bounce_1s_infinite_100ms] rounded-full bg-cyan-400" />
                <span className="h-3 w-0.5 animate-[bounce_1s_infinite_200ms] rounded-full bg-cyan-400" />
                <span className="h-2 w-0.5 animate-[bounce_1s_infinite_300ms] rounded-full bg-cyan-400" />
              </span>
            )}
          </button>
        )}

        {/* Discussions & Margin Notes */}
        <button
          type="button"
          onClick={() => {
            soundEffects.bloom();
            onOpenMargin?.("threads");
          }}
          className="flex w-full items-center justify-between rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 px-2.5 py-2 text-xs font-semibold text-foreground transition-all duration-200 cursor-pointer active:scale-[0.97]"
        >
          <div className="flex items-center gap-2">
            <ChatBubble className="h-3.5 w-3.5 text-amber-400" />
            <span>Margin Notes</span>
          </div>
          {hasNotes ? (
            <span className="rounded-full bg-amber-500/20 border border-amber-500/30 px-1.5 py-0.2 text-[9px] font-bold text-amber-300 tabular-nums">
              {marginThreadsCount + marginAnnotationsCount}
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground/60">Open</span>
          )}
        </button>

        {/* Backlinks & Revision History Mini-Grid */}
        <div className="grid grid-cols-2 gap-1.5 pt-0.5">
          <button
            type="button"
            onClick={() => {
              soundEffects.bloom();
              onOpenBacklinks?.();
            }}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 py-1.5 px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-all duration-200 cursor-pointer active:scale-[0.97]"
            title="What Links Here"
          >
            <LinkIcon className="h-3 w-3 text-cyan-400" />
            <span>Backlinks</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEffects.bloom();
              onOpenHistory?.();
            }}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 py-1.5 px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-all duration-200 cursor-pointer active:scale-[0.97]"
            title="Revision History"
          >
            <Clock className="h-3 w-3 text-purple-400" />
            <span>History</span>
          </button>
        </div>

        {/* Stash Button Integration */}
        <div className="pt-0.5">
          <StashButton title={title} isAuthenticated={isAuthenticated} />
        </div>
      </div>

      {/* 3. Top Categories / Domain Tags */}
      {categories.length > 0 && (
        <div className="facet-surface rounded-2xl border border-white/10 bg-card/40 p-3 shadow-xs backdrop-blur-xl">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 font-brand mb-2">
            Categories
          </div>
          <div className="flex flex-wrap gap-1.5">
            {categories.slice(0, 4).map((cat) => {
              const cleanCat = typeof cat === "string" ? cat : (cat as any)?.title ?? "";
              if (!cleanCat) return null;
              return (
                <Link
                  key={cleanCat}
                  href={`/wiki/categories/${encodeURIComponent(cleanCat.replace(/ /g, "_"))}`}
                  className="rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-all duration-150 active:scale-95 truncate max-w-[180px]"
                >
                  {cleanCat}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
