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

import type { ArticleAuthorInfo } from "./ArticleHeader";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";

interface ArticleCompanionHUDProps {
  contentHtml: string;
  lastModified?: string | null;
  authorInfo?: ArticleAuthorInfo | null;
  /** Authorship is on its way: its rows' place is held, so the cards below do not drop when it arrives. */
  authorsPending?: boolean;
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
      <div className="grid grid-cols-2 gap-2 pt-0.5">
        <Button
          variant="outline"
          size="sm"
          aria-label="What links here"
          onClick={() => onOpenBacklinks?.()}
          title="What links here"
          className="bg-fill-4 text-label-secondary hover:text-label"
        >
          <LinkIcon className="text-teal h-3 w-3" />
          <span>Backlinks</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          aria-label="Revision history"
          onClick={() => onOpenHistory?.()}
          title="Revision history"
          className="bg-fill-4 text-label-secondary hover:text-label"
        >
          <Clock className="text-label-secondary h-3 w-3" />
          <span>History</span>
        </Button>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => onOpenMargin?.("threads")}
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

const userHref = (name: string) =>
  `/wiki/User:${encodeURIComponent(name.replace(/ /g, "_"))}`;

// One locale and time zone, so the server's date and the browser's are the same text.
const shortDate = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
  year: "numeric",
});

const AVATAR_CLASS = "border-separator h-4 w-4 shrink-0 rounded-full border object-cover";

/** A label/value line of the provenance capsule. */
function Row({
  label,
  bordered,
  children,
}: {
  label: string;
  bordered?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "text-footnote flex items-center justify-between",
        bordered && "border-separator border-t pt-2"
      )}
    >
      <span className="text-label-secondary">{label}</span>
      {children}
    </div>
  );
}

function DateRow({
  label,
  value,
  valueClass,
  bordered,
}: {
  label: string;
  value?: string | null;
  valueClass: string;
  bordered?: boolean;
}) {
  if (!value) return null;
  return (
    <Row label={label} bordered={bordered}>
      <span className={cn("text-caption tabular-nums", valueClass)}>
        {shortDate.format(new Date(value))}
      </span>
    </Row>
  );
}

function UserRow({
  label,
  name,
  avatar,
  titlePrefix,
  weight,
  bordered,
}: {
  label: string;
  name?: string | null;
  avatar?: string | null;
  titlePrefix: string;
  weight: string;
  bordered?: boolean;
}) {
  if (!name) return null;
  return (
    <Row label={label} bordered={bordered}>
      <Link
        href={userHref(name)}
        className={cn(
          "text-label hover:text-tint inline-flex max-w-[140px] items-center gap-2 transition-colors",
          weight
        )}
        title={`${titlePrefix}${name}`}
      >
        {avatar ? (
          <img src={avatar} alt="" className={AVATAR_CLASS} loading="lazy" decoding="async" />
        ) : (
          <span className="text-label-secondary bg-fill-4 text-caption flex h-4 w-4 shrink-0 items-center justify-center rounded-full leading-none font-semibold">
            {name.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="truncate">{name}</span>
      </Link>
    </Row>
  );
}

type Contributor = NonNullable<ArticleAuthorInfo["contributors"]>[number];

const COUNT_CLASS = "text-label-secondary text-caption font-semibold tabular-nums";

function ContributorList({ contributors, total }: { contributors: Contributor[]; total: number }) {
  const [showAll, setShowAll] = React.useState(false);
  return (
    <div className="border-separator space-y-2 border-t pt-2">
      <div className="text-footnote flex items-center justify-between">
        <span className="text-label-secondary flex items-center gap-1 font-medium">
          <Users className="text-teal h-3 w-3" />
          Contributors
        </span>
        <span className={COUNT_CLASS}>{total}</span>
      </div>

      <div className="flex flex-wrap gap-1 pt-0.5">
        {(showAll ? contributors : contributors.slice(0, 3)).map((contrib) => (
          <Link
            key={contrib.username}
            href={userHref(contrib.username)}
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
        ))}

        {contributors.length > 3 && (
          <Button
            variant="link"
            size="sm"
            aria-expanded={showAll}
            onClick={() => setShowAll((v) => !v)}
            className="text-teal h-auto px-1 py-0.5"
          >
            {showAll ? "Show less" : `+${contributors.length - 3} more`}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Word count / reading time plus creator, dates, last editor and contributors. */
function ProvenanceCapsule({
  contentHtml,
  lastModified,
  authorInfo,
  authorsPending,
  hasLoreward,
}: {
  contentHtml: string;
  lastModified?: string | null;
  authorInfo?: ArticleAuthorInfo | null;
  authorsPending?: boolean;
  hasLoreward?: boolean;
}) {
  const { wordCount, readingTime } = useMemo(() => {
    const plainText = contentHtml
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const words = plainText ? plainText.split(/\s+/).length : 0;
    return { wordCount: words, readingTime: Math.max(1, Math.ceil(words / 200)) };
  }, [contentHtml]);
  const creatorName = authorInfo?.creator || authorInfo?.author;
  const lastEditorName = authorInfo?.lastEditor;
  const createdAt = authorInfo?.createdAt || authorInfo?.createdTimestamp;
  const updatedAt = lastModified || authorInfo?.lastEditedAt;
  const others = (authorInfo?.contributors ?? []).filter(
    (c) => c.username && (!creatorName || c.username.toLowerCase() !== creatorName.toLowerCase())
  );

  return (
    <div className="bg-surface rounded-card border-separator border p-3 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-300">
      <div className="border-separator mb-2 flex items-center justify-between gap-2 border-b pb-2">
        {hasLoreward && (
          <span className="border-yellow/30 bg-yellow/15 text-caption text-yellow inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold">
            <Trophy className="h-2.5 w-2.5" />
            Awarded
          </span>
        )}
      </div>

      <div className="text-label-secondary font-ui text-footnote space-y-2">
        <Row label="Read time">
          <span
            className="text-label font-semibold tabular-nums"
            title={`${wordCount.toLocaleString()} words`}
          >
            ~{readingTime} min
          </span>
        </Row>

        <UserRow
          label="Created by"
          name={creatorName}
          avatar={authorInfo?.creatorAvatar}
          titlePrefix="Original Author: "
          weight="font-semibold"
          bordered
        />
        <DateRow label="Created" value={createdAt} valueClass="text-label-secondary" />
        <DateRow label="Last updated" value={updatedAt} valueClass="text-label" bordered />
        {/* Last editor, only when distinct from the creator */}
        <UserRow
          label="Last editor"
          name={
            lastEditorName?.toLowerCase() !== creatorName?.toLowerCase() ? lastEditorName : null
          }
          avatar={authorInfo?.lastEditorAvatar}
          titlePrefix="Last edited by "
          weight="font-medium"
        />

        {authorsPending && (
          <div aria-hidden="true" className="border-separator min-h-42 space-y-2.5 border-t pt-2.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-12 w-full" />
          </div>
        )}

        {others.length > 0 && (
          <ContributorList
            contributors={others}
            total={authorInfo?.totalContributors || others.length + (creatorName ? 1 : 0)}
          />
        )}
      </div>
    </div>
  );
}

function NarratorButton({
  narrator,
}: {
  narrator: NonNullable<ArticleCompanionHUDProps["narrator"]>;
}) {
  const { isPlaying } = narrator;
  return (
    <Button
      variant="outline"
      aria-pressed={isPlaying}
      onClick={isPlaying ? narrator.pause : narrator.play}
      className={cn(
        "group rounded-row text-caption w-full justify-between px-3 font-semibold",
        isPlaying ? "border-teal/40 bg-teal/20 text-teal hover:bg-teal/20" : "text-label bg-fill-4"
      )}
    >
      <div className="flex items-center gap-2">
        {isPlaying ? (
          <Pause className="text-teal h-3.5 w-3.5 animate-pulse" />
        ) : (
          <Play className="text-label-secondary group-hover:text-label h-3.5 w-3.5" />
        )}
        <span>{isPlaying ? "Narrating..." : "Listen to article"}</span>
      </div>
      {isPlaying ? (
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
  );
}

export function ArticleCompanionHUD({
  contentHtml,
  lastModified,
  authorInfo,
  authorsPending = false,
  categories = [],
  awardsData,
  marginThreadsCount = 0,
  marginAnnotationsCount = 0,
  onOpenMargin,
  onOpenHistory,
  onOpenBacklinks,
  narrator,
  readOnly,
}: ArticleCompanionHUDProps) {
  const categoryNames = categories
    .slice(0, 4)
    .map((cat) => (typeof cat === "string" ? cat : ((cat as any)?.title ?? "")))
    .filter(Boolean);

  return (
    <div className="wikios-companion-hud flex flex-col gap-3 select-none">
      <ProvenanceCapsule
        contentHtml={contentHtml}
        lastModified={lastModified}
        authorInfo={authorInfo}
        authorsPending={authorsPending}
        hasLoreward={awardsData?.hasLoreward}
      />

      <div className="bg-surface rounded-card border-separator space-y-2 border p-3">
        {narrator && <NarratorButton narrator={narrator} />}
        {!readOnly && (
          <IxWikiPageTools
            notes={marginThreadsCount + marginAnnotationsCount}
            onOpenBacklinks={onOpenBacklinks}
            onOpenHistory={onOpenHistory}
            onOpenMargin={onOpenMargin}
          />
        )}
      </div>

      {categories.length > 0 && (
        <div className="bg-surface rounded-card border-separator border p-3">
          <div className="text-label-secondary text-footnote mb-2 font-medium">Categories</div>
          <div className="flex flex-wrap gap-2">
            {categoryNames.map((name) => (
              <Link
                key={name}
                href={`/util/categories/${encodeURIComponent(name.replace(/ /g, "_"))}`}
                className="text-label-secondary hover:text-label rounded-control border-separator bg-fill-4 text-caption hover:bg-fill-4 max-w-[180px] truncate border px-2 py-1 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150"
              >
                {name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
