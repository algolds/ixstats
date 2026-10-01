"use client";
// src/components/wiki-os/reader/ArticleCompanionHUD.tsx
// Apple-inspired companion rail widget positioned at the top of the outset gutter rail (above the TOC).
// Features reading metrics, audio narration toggle, Margin discussion count, and quick actions.

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

import { withBasePath } from "~/lib/base-path";
import type { ArticleAuthorInfo } from "./ArticleHeader";
import { Button } from "~/components/ui/button";

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
  /** Another wiki's page (ruling E-l): no IxWiki backlinks, history or margin. */
  readOnly?: boolean;
}

/** Backlinks, history and margin notes — IxWiki's own, so another wiki's page (read-only) has none. */
function IxWikiPageTools({
  notes,
  onOpenBacklinks,
  onOpenHistory,
  onOpenMargin,
}: Pick<ArticleCompanionHUDProps, "onOpenBacklinks" | "onOpenHistory" | "onOpenMargin"> & {
  notes: number;
}) {
  return (
    <>
      {/* Backlinks & Revision History Mini-Grid */}
      <div className="grid grid-cols-2 gap-2 pt-0.5">
        <Button
          variant="bordered"
          size="sm"
          aria-label="What Links Here"
          onClick={() => {
            onOpenBacklinks?.();
          }}
          title="What Links Here"
          className="bg-fill-4 text-label-secondary hover:text-label"
        >
          <LinkIcon className="text-teal h-3 w-3" />
          <span>Backlinks</span>
        </Button>

        <Button
          variant="bordered"
          size="sm"
          aria-label="Revision History"
          onClick={() => {
            onOpenHistory?.();
          }}
          title="Revision History"
          className="bg-fill-4 text-label-secondary hover:text-label"
        >
          <Clock className="text-label-secondary h-3 w-3" />
          <span>History</span>
        </Button>
      </div>

      {/* Margin notes — quiet status row (not a primary button). Left rail remains the control. */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          onOpenMargin?.("threads");
        }}
        className="group text-label-secondary hover:text-label text-caption mt-1 w-full justify-between px-2 font-normal"
      >
        <span className="flex items-center gap-2">
          <ChatBubble className="text-yellow/80 group-hover:text-yellow h-3 w-3" />
          <span>Margin notes</span>
          {notes > 0 ? (
            <span className="text-label-secondary tabular-nums">
              · {notes} {notes === 1 ? "thread" : "threads"}
            </span>
          ) : (
            <span className="text-label-secondary">· none yet</span>
          )}
        </span>
        <span className="text-label-secondary group-hover:text-label transition-colors">→</span>
      </Button>
    </>
  );
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
  readOnly,
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

  if (isCollapsed) return null;

  return (
    <div className="wikios-companion-hud flex flex-col gap-3 select-none">
      {/* 1. Article Intelligence & Provenance Capsule */}
      <div className="bg-surface rounded-card border-separator border p-3 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-300">
        <div className="border-separator mb-2 flex items-center justify-between gap-2 border-b pb-2">
          {awardsData?.hasLoreward && (
            <span className="border-yellow/30 bg-yellow/15 text-caption text-yellow inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold">
              <Trophy className="h-2.5 w-2.5" />
              Awarded
            </span>
          )}
        </div>

        <div className="text-label-secondary font-ui text-footnote space-y-2">
          <div className="text-footnote flex items-center justify-between">
            <span className="text-label-secondary">Read Time</span>
            <span
              className="text-label font-semibold tabular-nums"
              title={`${wordCount.toLocaleString()} words`}
            >
              ~{readingTime} min
            </span>
          </div>

          {/* Original Creator / Author — with IxnayID avatar when available */}
          {creatorName && (
            <div className="border-separator text-footnote flex items-center justify-between border-t pt-2">
              <span className="text-label-secondary">Created by</span>
              <Link
                href={withBasePath(
                  `/wiki/User:${encodeURIComponent(creatorName.replace(/ /g, "_"))}`
                )}
                className="text-label hover:text-tint inline-flex max-w-[140px] items-center gap-2 font-semibold transition-colors"
                title={`Original Author: ${creatorName}`}
              >
                {creatorAvatar ? (
                  <img
                    src={creatorAvatar}
                    alt=""
                    className="border-separator h-4 w-4 shrink-0 rounded-full border object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span className="text-label-secondary bg-fill-4 text-caption flex h-4 w-4 shrink-0 items-center justify-center rounded-full leading-none font-semibold">
                    {creatorName.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="truncate">{creatorName}</span>
              </Link>
            </div>
          )}

          {/* Creation Date */}
          {createdAt && (
            <div className="text-footnote flex items-center justify-between">
              <span className="text-label-secondary">Created</span>
              <span className="text-label-secondary text-caption tabular-nums">
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
            <div className="border-separator text-footnote flex items-center justify-between border-t pt-2">
              <span className="text-label-secondary">Last Updated</span>
              <span className="text-label text-caption tabular-nums">
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
            <div className="text-footnote flex items-center justify-between">
              <span className="text-label-secondary">Last Editor</span>
              <Link
                href={withBasePath(
                  `/wiki/User:${encodeURIComponent(lastEditorName.replace(/ /g, "_"))}`
                )}
                className="text-label hover:text-tint inline-flex max-w-[140px] items-center gap-2 font-medium transition-colors"
                title={`Last edited by ${lastEditorName}`}
              >
                {lastEditorAvatar ? (
                  <img
                    src={lastEditorAvatar}
                    alt=""
                    className="border-separator h-4 w-4 shrink-0 rounded-full border object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span className="text-label-secondary bg-fill-4 text-caption flex h-4 w-4 shrink-0 items-center justify-center rounded-full leading-none font-semibold">
                    {lastEditorName.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="truncate">{lastEditorName}</span>
              </Link>
            </div>
          )}

          {/* Other Contributors Section */}
          {otherContributors.length > 0 && (
            <div className="border-separator space-y-2 border-t pt-2">
              <div className="text-footnote flex items-center justify-between">
                <span className="text-label-secondary flex items-center gap-1 font-medium">
                  <Users className="text-teal h-3 w-3" />
                  Contributors
                </span>
                <span className="text-label-secondary text-caption font-semibold tabular-nums">
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
                      className="text-label rounded-control-sm border-separator bg-fill-4 text-caption hover:bg-fill-4 hover:text-teal inline-flex max-w-[140px] items-center gap-1 truncate border px-2 py-0.5 transition-colors"
                      title={`${contrib.username} (${contrib.editCount || 1} edits)`}
                    >
                      <span>{contrib.username}</span>
                      {contrib.editCount && contrib.editCount > 1 && (
                        <span className="text-label-secondary text-footnote tabular-nums">
                          ({contrib.editCount})
                        </span>
                      )}
                    </Link>
                  )
                )}

                {otherContributors.length > 3 && (
                  <Button
                    variant="link"
                    size="sm"
                    aria-expanded={showAllContributors}
                    onClick={() => setShowAllContributors((v) => !v)}
                    className="text-teal h-auto px-1 py-0.5"
                  >
                    {showAllContributors ? "Show less" : `+${otherContributors.length - 3} more`}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Quick Actions Glass Control Center */}
      <div className="bg-surface rounded-card border-separator space-y-2 border p-3">
        {/* Listen / Voice Narrator Toggle */}
        {narrator && (
          <Button
            variant="bordered"
            aria-pressed={narrator.isPlaying}
            onClick={() => {
              if (narrator.isPlaying) {
                narrator.pause();
              } else {
                narrator.play();
              }
            }}
            className={cn(
              "group rounded-row text-caption w-full justify-between px-3 font-semibold",
              narrator.isPlaying
                ? "border-teal/40 bg-teal/20 text-teal hover:bg-teal/20"
                : "text-label bg-fill-4"
            )}
          >
            <div className="flex items-center gap-2">
              {narrator.isPlaying ? (
                <Pause className="text-teal h-3.5 w-3.5 animate-pulse" />
              ) : (
                <Play className="text-label-secondary group-hover:text-label h-3.5 w-3.5" />
              )}
              <span>{narrator.isPlaying ? "Narrating..." : "Listen to article"}</span>
            </div>
            {narrator.isPlaying ? (
              <span className="flex items-center gap-0.5">
                <span className="bg-teal/70 h-2 w-0.5 animate-[bounce_1s_infinite_100ms] rounded-full" />
                <span className="bg-teal/70 h-3 w-0.5 animate-[bounce_1s_infinite_200ms] rounded-full" />
                <span className="bg-teal/70 h-2 w-0.5 animate-[bounce_1s_infinite_300ms] rounded-full" />
              </span>
            ) : (
              <span className="border-teal/30 bg-teal/15 text-eyebrow text-teal rounded-full border px-2 py-0.5 leading-none">
                Beta
              </span>
            )}
          </Button>
        )}

        {!readOnly && (
          <IxWikiPageTools
            notes={marginThreadsCount + marginAnnotationsCount}
            onOpenBacklinks={onOpenBacklinks}
            onOpenHistory={onOpenHistory}
            onOpenMargin={onOpenMargin}
          />
        )}
      </div>

      {/* 3. Top Categories / Domain Tags */}
      {categories.length > 0 && (
        <div className="bg-surface rounded-card border-separator border p-3">
          <div className="text-label-secondary font-brand text-eyebrow mb-2">Categories</div>
          <div className="flex flex-wrap gap-2">
            {categories.slice(0, 4).map((cat) => {
              const cleanCat = typeof cat === "string" ? cat : ((cat as any)?.title ?? "");
              if (!cleanCat) return null;
              return (
                <Link
                  key={cleanCat}
                  href={`/wiki/categories/${encodeURIComponent(cleanCat.replace(/ /g, "_"))}`}
                  className="text-label-secondary hover:text-label rounded-control border-separator bg-fill-4 text-caption hover:bg-fill-4 max-w-[180px] truncate border px-2 py-1 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150 active:scale-[0.98]"
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
