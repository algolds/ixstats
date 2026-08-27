// src/components/wiki-os/reader/ArticleCompanionHUD.tsx
// Apple-inspired companion rail widget positioned at the top of the outset gutter rail (above the TOC).
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
  // oxlint-disable-next-line eslint/no-unused-vars
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
  // oxlint-disable-next-line eslint/no-unused-vars
  isAuthenticated = false,
  isCollapsed = false,
}: ArticleCompanionHUDProps) {
  const [showAllContributors, setShowAllContributors] = React.useState(false);

  // Calculate word count & estimated reading time dynamically
  const { wordCount, readingTime } = useMemo(() => {
    if (!contentHtml) return { wordCount: 0, readingTime: 1 };
    const plainText = contentHtml
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const words = plainText ? plainText.split(/\s+/).length : 0;
    const time = Math.max(1, Math.ceil(words / 200));
    return { wordCount: words, readingTime: time };
  }, [contentHtml]);

  const creator = authorInfo?.creator;
  const creatorName =
    typeof creator === "object"
      ? (creator as any)?.username
      : creator || (authorInfo as any)?.author || null;
  const creatorAvatar =
    (typeof creator === "object" ? (creator as any)?.avatar : null) ||
    (authorInfo as any)?.creatorAvatar ||
    null;

  const createdAt =
    authorInfo?.createdAt ||
    (typeof creator === "object" ? (creator as any)?.timestamp : null) ||
    (authorInfo as any)?.createdTimestamp ||
    null;

  const lastEditor = authorInfo?.lastEditor;
  const lastEditorName =
    typeof lastEditor === "object" ? (lastEditor as any)?.username : lastEditor || null;
  const lastEditorAvatar =
    (typeof lastEditor === "object" ? (lastEditor as any)?.avatar : null) ||
    (authorInfo as any)?.lastEditorAvatar ||
    null;

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
    // oxlint-disable-next-line
  }, [rawContributors, creatorName]);

  const totalContributorsCount =
    authorInfo?.totalContributors || otherContributors.length + (creatorName ? 1 : 0);

  const hasNotes = marginThreadsCount > 0 || marginAnnotationsCount > 0;

  if (isCollapsed) return null;

  return (
    <div className="wikios-companion-hud flex flex-col gap-3 select-none">
      {/* 1. Article Intelligence & Provenance Capsule */}
      <div className="facet-surface bg-card/40 rounded-2xl border border-white/10 p-3 shadow-xs backdrop-blur-xl transition-all duration-300">
        <div className="border-border/30 mb-2.5 flex items-center justify-between gap-2 border-b pb-2">
          {awardsData?.hasLoreward && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-400">
              <Trophy className="h-2.5 w-2.5" />
              Awarded
            </span>
          )}
        </div>

        <div className="text-muted-foreground font-ui space-y-2 text-xs">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground/70">Read Time</span>
            <span
              className="text-foreground font-semibold tabular-nums"
              title={`${wordCount.toLocaleString()} words`}
            >
              ~{readingTime} min
            </span>
          </div>

          {/* Original Creator / Author — with IxnayID avatar when available */}
          {creatorName && (
            <div className="border-border/20 flex items-center justify-between border-t pt-1.5 text-[11px]">
              <span className="text-muted-foreground/70">Created by</span>
              <Link
                href={withBasePath(
                  `/wiki/User:${encodeURIComponent(creatorName.replace(/ /g, "_"))}`
                )}
                className="text-foreground inline-flex max-w-[140px] items-center gap-1.5 font-semibold transition-colors hover:text-purple-400"
                title={`Original Author: ${creatorName}`}
              >
                {creatorAvatar ? (
                  <img
                    src={creatorAvatar}
                    alt=""
                    className="h-4 w-4 shrink-0 rounded-full border border-white/10 object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span className="text-muted-foreground flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/10 text-[8px] leading-none font-bold">
                    {creatorName.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="truncate">{creatorName}</span>
              </Link>
            </div>
          )}

          {/* Creation Date */}
          {createdAt && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground/70">Created</span>
              <span className="text-foreground/80 text-[10.5px] font-medium tabular-nums">
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
            <div className="border-border/20 flex items-center justify-between border-t pt-1.5 text-[11px]">
              <span className="text-muted-foreground/70">Last Updated</span>
              <span className="text-foreground/90 text-[10.5px] font-medium tabular-nums">
                {new Date(effectiveLastModified).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
          )}

          {/* Last Editor (if distinct) — with IxnayID avatar when available */}
          {lastEditorName && lastEditorName.toLowerCase() !== creatorName?.toLowerCase() && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground/70">Last Editor</span>
              <Link
                href={withBasePath(
                  `/wiki/User:${encodeURIComponent(lastEditorName.replace(/ /g, "_"))}`
                )}
                className="text-foreground/90 inline-flex max-w-[140px] items-center gap-1.5 font-medium transition-colors hover:text-purple-400"
                title={`Last edited by ${lastEditorName}`}
              >
                {lastEditorAvatar ? (
                  <img
                    src={lastEditorAvatar}
                    alt=""
                    className="h-4 w-4 shrink-0 rounded-full border border-white/10 object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span className="text-muted-foreground flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/10 text-[8px] leading-none font-bold">
                    {lastEditorName.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="truncate">{lastEditorName}</span>
              </Link>
            </div>
          )}

          {/* Other Contributors Section */}
          {otherContributors.length > 0 && (
            <div className="border-border/20 space-y-1.5 border-t pt-2">
              <div className="flex items-center justify-between text-[10.5px]">
                <span className="text-muted-foreground/80 flex items-center gap-1 font-medium">
                  <Users className="h-3 w-3 text-cyan-400" />
                  Contributors
                </span>
                <span className="text-muted-foreground/70 text-[10px] font-bold tabular-nums">
                  {totalContributorsCount}
                </span>
              </div>

              <div className="flex flex-wrap gap-1 pt-0.5">
                {(showAllContributors ? otherContributors : otherContributors.slice(0, 3)).map(
                  (contrib) => (
                    <Link
                      key={contrib.username}
                      href={withBasePath(
                        `/wiki/User:${encodeURIComponent(contrib.username.replace(/ /g, "_"))}`
                      )}
                      className="text-foreground/90 inline-flex max-w-[140px] items-center gap-1 truncate rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium transition-colors hover:bg-white/10 hover:text-cyan-300"
                      title={`${contrib.username} (${contrib.editCount || 1} edits)`}
                    >
                      <span>{contrib.username}</span>
                      {contrib.editCount && contrib.editCount > 1 && (
                        <span className="text-muted-foreground/70 text-[8.5px] tabular-nums">
                          ({contrib.editCount})
                        </span>
                      )}
                    </Link>
                  )
                )}

                {otherContributors.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setShowAllContributors((v) => !v)}
                    className="cursor-pointer px-1 py-0.5 text-[9.5px] font-semibold text-cyan-400 transition-colors hover:text-cyan-300"
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
      <div className="facet-surface bg-card/40 space-y-1.5 rounded-2xl border border-white/10 p-2.5 shadow-xs backdrop-blur-xl">
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
              "group flex w-full cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-xs font-semibold transition-all duration-200 active:scale-[0.97]",
              narrator.isPlaying
                ? "border border-cyan-500/40 bg-cyan-500/20 text-cyan-300 shadow-xs"
                : "text-foreground border border-white/5 bg-white/5 hover:bg-white/10"
            )}
          >
            <div className="flex items-center gap-2">
              {narrator.isPlaying ? (
                <Pause className="h-3.5 w-3.5 animate-pulse text-cyan-400" />
              ) : (
                <Play className="text-muted-foreground group-hover:text-foreground h-3.5 w-3.5" />
              )}
              <span>{narrator.isPlaying ? "Narrating..." : "Listen to article"}</span>
            </div>
            {narrator.isPlaying ? (
              <span className="flex items-center gap-0.5">
                <span className="h-2 w-0.5 animate-[bounce_1s_infinite_100ms] rounded-full bg-cyan-400" />
                <span className="h-3 w-0.5 animate-[bounce_1s_infinite_200ms] rounded-full bg-cyan-400" />
                <span className="h-2 w-0.5 animate-[bounce_1s_infinite_300ms] rounded-full bg-cyan-400" />
              </span>
            ) : (
              <span className="rounded-full border border-cyan-500/30 bg-cyan-500/15 px-1.5 py-0.5 text-[8.5px] leading-none font-bold tracking-wider text-cyan-400 uppercase">
                Beta
              </span>
            )}
          </button>
        )}

        {/* Backlinks & Revision History Mini-Grid */}
        <div className="grid grid-cols-2 gap-1.5 pt-0.5">
          <button
            type="button"
            onClick={() => {
              soundEffects.bloom();
              onOpenBacklinks?.();
            }}
            className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-white/5 bg-white/5 px-2 py-1.5 text-[11px] font-medium transition-all duration-200 hover:bg-white/10 active:scale-[0.97]"
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
            className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-white/5 bg-white/5 px-2 py-1.5 text-[11px] font-medium transition-all duration-200 hover:bg-white/10 active:scale-[0.97]"
            title="Revision History"
          >
            <Clock className="h-3 w-3 text-purple-400" />
            <span>History</span>
          </button>
        </div>

        {/* Margin notes — quiet status row (not a primary button). Left rail remains the control. */}
        <button
          type="button"
          onClick={() => {
            soundEffects.bloom();
            onOpenMargin?.("threads");
          }}
          className="group border-border/20 text-muted-foreground hover:text-foreground mt-1 flex w-full cursor-pointer items-center justify-between border-t pt-2 text-[11px] font-medium transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <ChatBubble className="h-3 w-3 text-amber-400/80 group-hover:text-amber-400" />
            <span>Margin notes</span>
            {hasNotes ? (
              <span className="text-muted-foreground/60 tabular-nums">
                · {marginThreadsCount + marginAnnotationsCount}{" "}
                {marginThreadsCount + marginAnnotationsCount === 1 ? "thread" : "threads"}
              </span>
            ) : (
              <span className="text-muted-foreground/40">· none yet</span>
            )}
          </span>
          <span className="text-muted-foreground/40 group-hover:text-foreground transition-colors">
            →
          </span>
        </button>
      </div>

      {/* 3. Top Categories / Domain Tags */}
      {categories.length > 0 && (
        <div className="facet-surface bg-card/40 rounded-2xl border border-white/10 p-3 shadow-xs backdrop-blur-xl">
          <div className="text-muted-foreground/80 font-brand mb-2 text-[10px] font-bold tracking-wider uppercase">
            Categories
          </div>
          <div className="flex flex-wrap gap-1.5">
            {categories.slice(0, 4).map((cat) => {
              const cleanCat = typeof cat === "string" ? cat : ((cat as any)?.title ?? "");
              if (!cleanCat) return null;
              return (
                <Link
                  key={cleanCat}
                  href={`/wiki/categories/${encodeURIComponent(cleanCat.replace(/ /g, "_"))}`}
                  className="text-muted-foreground hover:text-foreground max-w-[180px] truncate rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-medium transition-all duration-150 hover:bg-white/10 active:scale-95"
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
