"use client";

/**
 * GlobalLinkTooltips — Intercepts ALL link hovers across the entire app.
 *
 * Uses document-level event delegation to detect any <a> pointing to:
 * - ixwiki.com/wiki/*       → Wiki article preview tooltip
 * - iiwiki.com/wiki/*       → IIWiki article preview tooltip
 * - forum.ixwiki.com/threads/* → Forum thread preview tooltip
 * - maps.ixwiki.com/*       → Map link indicator
 *
 * Mount once in the root layout as a sibling (it wraps nothing) — every link gets
 * tooltips automatically, no per-component wrapping needed. Future wiki/forum links
 * added anywhere in the app will automatically get tooltip coverage.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Badge } from "~/components/ui/badge";
import { VirtualAnchorHoverCard } from "~/components/ui/hover-card";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";
import {
  OpenBook as BookOpen,
  OpenNewWindow as ExternalLink,
  ChatBubble as MessageSquare,
  Eye,
  Group as Users,
} from "iconoir-react";
import { titleToWikiOSPath } from "~/lib/wiki-os/transformers/url-compat";

// ──────────────────────────────────────────────
// Link detection types
// ──────────────────────────────────────────────

type DetectedLink =
  { kind: "wiki"; title: string; wiki: "ixwiki" | "iiwiki" } | { kind: "forum"; threadId: number };

/** Parse a link href and return detection info, or null if not a recognized link */
function detectLink(href: string): DetectedLink | null {
  // Wiki links: ixwiki.com/wiki/Title, /wiki/Title (relative), or /wiki/Title (WikiOS)
  const ixMatch =
    href.match(/(?:https?:\/\/)?ixwiki\.com\/wiki\/([^#?]+)/) ??
    href.match(/^(?:\/[^/]+)?\/wiki\/([^#?]+)/) ??
    href.match(/^(?:\/[^/]+)?\/w\/([^#?]+)/);
  if (ixMatch) {
    const title = decodeURIComponent(ixMatch[1]!).replace(/_/g, " ");
    const lowerTitle = title.toLowerCase();
    // Skip special pages that won't have useful previews
    if (
      lowerTitle.startsWith("special:") ||
      lowerTitle.startsWith("special/") ||
      lowerTitle.startsWith("file:") ||
      lowerTitle.startsWith("file/") ||
      lowerTitle.startsWith("category:") ||
      lowerTitle.startsWith("category/") ||
      lowerTitle.startsWith("template:") ||
      lowerTitle.startsWith("help:") ||
      lowerTitle.startsWith("user:") ||
      lowerTitle.startsWith("talk:") ||
      lowerTitle.startsWith("wiki:")
    )
      return null;
    return { kind: "wiki", title, wiki: "ixwiki" };
  }

  // IIWiki links
  const iiMatch = href.match(/(?:https?:\/\/)?iiwiki\.(?:com|us)\/wiki\/([^#?]+)/);
  if (iiMatch) {
    const title = decodeURIComponent(iiMatch[1]!).replace(/_/g, " ");
    const lowerTitle = title.toLowerCase();
    if (
      lowerTitle.startsWith("special:") ||
      lowerTitle.startsWith("special/") ||
      lowerTitle.startsWith("file:") ||
      lowerTitle.startsWith("file/") ||
      lowerTitle.startsWith("category:") ||
      lowerTitle.startsWith("category/") ||
      lowerTitle.startsWith("template:") ||
      lowerTitle.startsWith("help:") ||
      lowerTitle.startsWith("user:") ||
      lowerTitle.startsWith("talk:") ||
      lowerTitle.startsWith("wiki:")
    )
      return null;
    return { kind: "wiki", title, wiki: "iiwiki" };
  }

  // Forum thread links: forum.ixwiki.com/threads/title.123/ or /threads/123/
  const forumMatch = href.match(/forum\.ixwiki\.com\/threads\/(?:[^/]*\.)?(\d+)/);
  if (forumMatch) {
    const threadId = parseInt(forumMatch[1]!, 10);
    if (!isNaN(threadId) && threadId > 0) {
      return { kind: "forum", threadId };
    }
  }

  return null;
}

// ──────────────────────────────────────────────
// Tooltip host component
// ──────────────────────────────────────────────

export function GlobalLinkTooltips() {
  // The detected link and the <a> it came from (the hover card's virtual anchor). Kept after the
  // card closes so its content stays put during the exit animation.
  const [active, setActive] = useState<{ link: DetectedLink; el: HTMLElement } | null>(null);
  const [open, setOpen] = useState(false);
  const showTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const activeElementRef = useRef<HTMLElement | null>(null);

  const show = useCallback((link: DetectedLink, el: HTMLElement) => {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
    activeElementRef.current = el;
    showTimeoutRef.current = setTimeout(() => {
      setActive({ link, el });
      setOpen(true);
    }, 350);
  }, []);

  const hide = useCallback(() => {
    if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    hideTimeoutRef.current = setTimeout(() => {
      setOpen(false);
      activeElementRef.current = null;
    }, 200);
  }, []);

  const keepOpen = useCallback(() => {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
  }, []);

  useEffect(() => {
    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest("a[href]") as HTMLAnchorElement | null;
      if (!link) return;

      // Don't show tooltip for links inside another tooltip, the wiki sidebar, or WikiOS shells
      if (link.closest(".global-link-tooltip")) return;
      if (link.closest(".no-wiki-tooltip")) return;
      if (link.closest(".wikios-root")) return;
      if (link.closest(".wikios-shell")) return;

      const href = link.getAttribute("href") ?? "";
      if (!href) return;

      const detected = detectLink(href);
      if (!detected) return;

      // Don't re-trigger for the same element
      if (activeElementRef.current === link) {
        keepOpen();
        return;
      }

      show(detected, link);
    };

    const handleMouseOut = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest("a[href]");
      if (!link) return;

      // Only hide if we're leaving a detected link
      if (link === activeElementRef.current || activeElementRef.current === null) {
        hide();
      }
    };

    document.addEventListener("mouseover", handleMouseOver, { passive: true });
    document.addEventListener("mouseout", handleMouseOut, { passive: true });

    return () => {
      document.removeEventListener("mouseover", handleMouseOver);
      document.removeEventListener("mouseout", handleMouseOut);
      if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [show, hide, keepOpen]);

  // Hover card anchored to the hovered <a> (found by delegation, so a virtual anchor): below the
  // link, start-aligned, flipping/shifting to stay on screen.
  return (
    <VirtualAnchorHoverCard
      anchor={active?.el ?? null}
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setOpen(false);
          activeElementRef.current = null;
        }
      }}
      side="bottom"
      align="start"
      className="global-link-tooltip w-80 p-3"
      onMouseEnter={keepOpen}
      onMouseLeave={() => {
        setOpen(false);
        activeElementRef.current = null;
      }}
    >
      {active?.link.kind === "wiki" ? (
        <WikiTooltipBody title={active.link.title} wiki={active.link.wiki} />
      ) : active?.link.kind === "forum" ? (
        <ForumTooltipBody threadId={active.link.threadId} />
      ) : null}
    </VirtualAnchorHoverCard>
  );
}

// ──────────────────────────────────────────────
// Wiki tooltip body
// ──────────────────────────────────────────────

function WikiTooltipBody({ title, wiki }: { title: string; wiki: "ixwiki" | "iiwiki" }) {
  const { data: intro } = api.wikios.getIntro.useQuery({ title, wiki }, { staleTime: 30 * 60_000 });

  const articleUrl =
    wiki === "ixwiki"
      ? titleToWikiOSPath(title)
      : `https://iiwiki.com/wiki/${encodeURIComponent(title)}`;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <BookOpen className="text-tint size-3.5 shrink-0" aria-hidden="true" />
        <span className="text-label text-headline truncate">{title}</span>
        <Badge variant="default" className="ml-auto">
          {wiki === "ixwiki" ? "IxWiki" : "IIWiki"}
        </Badge>
      </div>
      {intro?.text ? (
        <p className="text-label-secondary text-footnote line-clamp-4 leading-relaxed">
          {intro.text.substring(0, 300)}
          {intro.text.length > 300 ? "…" : ""}
        </p>
      ) : (
        <Skeleton className="rounded-control-sm h-10 w-full" />
      )}
      <a
        href={articleUrl}
        {...(wiki === "ixwiki" ? {} : { target: "_blank", rel: "noopener noreferrer" })}
        className="text-caption text-tint hover:text-tint-hover flex items-center gap-1 transition-colors"
      >
        Read full article <ExternalLink className="size-3" />
      </a>
    </div>
  );
}

// ──────────────────────────────────────────────
// Forum tooltip body
// ──────────────────────────────────────────────

function ForumTooltipBody({ threadId }: { threadId: number }) {
  const { data: thread } = api.wikios.getForumThreadPreview.useQuery(
    { threadId },
    { staleTime: 10 * 60_000 }
  );

  const forumUrl = `https://forum.ixwiki.com/threads/${threadId}/`;

  if (!thread) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="text-orange h-3.5 w-3.5 shrink-0" />
          <span className="text-headline text-label">Loading thread...</span>
        </div>
        <Skeleton className="rounded-control-sm h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <MessageSquare className="text-orange h-3.5 w-3.5 shrink-0" />
        <span className="text-label text-headline truncate">{thread.title}</span>
      </div>
      {thread.forumName && <Badge variant="warning">{thread.forumName}</Badge>}
      {thread.excerpt && (
        <p className="text-label-secondary text-footnote line-clamp-3 leading-relaxed">
          {thread.excerpt.substring(0, 250)}
          {thread.excerpt.length > 250 ? "…" : ""}
        </p>
      )}
      <div className="text-label-secondary text-footnote flex items-center gap-3">
        <span className="flex items-center gap-0.5">
          <Users className="size-3" />
          {thread.author}
        </span>
        <span className="flex items-center gap-0.5">
          <MessageSquare className="size-3" />
          {thread.replyCount} replies
        </span>
        <span className="flex items-center gap-0.5">
          <Eye className="size-3" />
          {thread.viewCount}
        </span>
      </div>
      <a
        href={forumUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-caption text-tint hover:text-tint-hover flex items-center gap-1 transition-colors"
      >
        Open thread <ExternalLink className="size-3" />
      </a>
    </div>
  );
}
