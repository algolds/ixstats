// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

/**
 * GlobalLinkTooltipProvider — Intercepts ALL link hovers across the entire app.
 *
 * Uses document-level event delegation to detect any <a> pointing to:
 * - ixwiki.com/wiki/*       → Wiki article preview tooltip
 * - iiwiki.com/wiki/*       → IIWiki article preview tooltip
 * - forum.ixwiki.com/threads/* → Forum thread preview tooltip
 * - maps.ixwiki.com/*       → Map link indicator
 *
 * Mount once in the root layout — every link gets tooltips automatically,
 * no per-component wrapping needed. Future wiki/forum links added anywhere
 * in the app will automatically get tooltip coverage.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { api } from "~/trpc/react";
import { BookOpen, ExternalLink, MessageSquare, Eye, Users } from "lucide-react";
import { titleToWikiOSPath } from "~/lib/wiki-os/url-compat";

// ──────────────────────────────────────────────
// Link detection types
// ──────────────────────────────────────────────

type DetectedLink =
  | { kind: "wiki"; title: string; wiki: "ixwiki" | "iiwiki"; x: number; y: number }
  | { kind: "forum"; threadId: number; x: number; y: number };

/** Parse a link href and return detection info, or null if not a recognized link */
function detectLink(href: string, rect: DOMRect): DetectedLink | null {
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
    return { kind: "wiki", title, wiki: "ixwiki", x: clampX(rect), y: rect.bottom + 4 };
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
    return { kind: "wiki", title, wiki: "iiwiki", x: clampX(rect), y: rect.bottom + 4 };
  }

  // Forum thread links: forum.ixwiki.com/threads/title.123/ or /threads/123/
  const forumMatch = href.match(/forum\.ixwiki\.com\/threads\/(?:[^/]*\.)?(\d+)/);
  if (forumMatch) {
    const threadId = parseInt(forumMatch[1]!, 10);
    if (!isNaN(threadId) && threadId > 0) {
      return { kind: "forum", threadId, x: clampX(rect), y: rect.bottom + 4 };
    }
  }

  return null;
}

function clampX(rect: DOMRect): number {
  return Math.min(
    Math.max(rect.left, 8),
    (typeof window !== "undefined" ? window.innerWidth : 1200) - 340
  );
}

// ──────────────────────────────────────────────
// Provider component
// ──────────────────────────────────────────────

export function GlobalLinkTooltipProvider({ children }: { children: React.ReactNode }) {
  const [activeLink, setActiveLink] = useState<DetectedLink | null>(null);
  const showTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const activeElementRef = useRef<HTMLElement | null>(null);

  const show = useCallback((link: DetectedLink, el: HTMLElement) => {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
    activeElementRef.current = el;
    showTimeoutRef.current = setTimeout(() => {
      setActiveLink(link);
    }, 350);
  }, []);

  const hide = useCallback(() => {
    if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    hideTimeoutRef.current = setTimeout(() => {
      setActiveLink(null);
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

      const rect = link.getBoundingClientRect();
      const detected = detectLink(href, rect);
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

  return (
    <>
      {children}
      {activeLink &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="global-link-tooltip border-border bg-card animate-in fade-in-0 zoom-in-95 fixed z-[9999] w-80 rounded-xl border p-3 shadow-xl duration-150"
            style={{ left: activeLink.x, top: activeLink.y }}
            onMouseEnter={keepOpen}
            onMouseLeave={() => {
              setActiveLink(null);
              activeElementRef.current = null;
            }}
          >
            {activeLink.kind === "wiki" ? (
              <WikiTooltipBody title={activeLink.title} wiki={activeLink.wiki} />
            ) : (
              <ForumTooltipBody threadId={activeLink.threadId} />
            )}
          </div>,
          document.body
        )}
    </>
  );
}

// ──────────────────────────────────────────────
// Wiki tooltip body
// ──────────────────────────────────────────────

function WikiTooltipBody({ title, wiki }: { title: string; wiki: "ixwiki" | "iiwiki" }) {
  const { data: intro } = api.wiki.getIntro.useQuery({ title, wiki }, { staleTime: 30 * 60_000 });

  const articleUrl =
    wiki === "ixwiki"
      ? titleToWikiOSPath(title)
      : `https://iiwiki.com/wiki/${encodeURIComponent(title)}`;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <BookOpen className="h-3.5 w-3.5 shrink-0 text-amber-500" />
        <span className="text-foreground truncate text-sm font-semibold">{title}</span>
        <span className="bg-muted text-muted-foreground ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium">
          {wiki === "ixwiki" ? "IxWiki" : "IIWiki"}
        </span>
      </div>
      {intro?.text ? (
        <p className="text-foreground/80 line-clamp-4 text-xs leading-relaxed">
          {intro.text.substring(0, 300)}
          {intro.text.length > 300 ? "…" : ""}
        </p>
      ) : (
        <div className="bg-muted h-10 animate-pulse rounded" />
      )}
      <a
        href={articleUrl}
        {...(wiki === "ixwiki" ? {} : { target: "_blank", rel: "noopener noreferrer" })}
        className="flex items-center gap-1 text-[10px] font-medium text-blue-600 transition-colors hover:text-blue-500"
      >
        Read full article <ExternalLink className="h-2.5 w-2.5" />
      </a>
    </div>
  );
}

// ──────────────────────────────────────────────
// Forum tooltip body
// ──────────────────────────────────────────────

function ForumTooltipBody({ threadId }: { threadId: number }) {
  const { data: thread } = api.wiki.getForumThreadPreview.useQuery(
    { threadId },
    { staleTime: 10 * 60_000 }
  );

  const forumUrl = `https://forum.ixwiki.com/threads/${threadId}/`;

  if (!thread) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-3.5 w-3.5 shrink-0 text-violet-500" />
          <span className="text-foreground text-sm font-medium">Loading thread...</span>
        </div>
        <div className="bg-muted h-10 animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-3.5 w-3.5 shrink-0 text-violet-500" />
        <span className="text-foreground truncate text-sm font-semibold">{thread.title}</span>
      </div>
      {thread.forumName && (
        <span className="inline-block rounded-full bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-medium text-violet-400">
          {thread.forumName}
        </span>
      )}
      {thread.excerpt && (
        <p className="text-foreground/80 line-clamp-3 text-xs leading-relaxed">
          {thread.excerpt.substring(0, 250)}
          {thread.excerpt.length > 250 ? "…" : ""}
        </p>
      )}
      <div className="text-muted-foreground flex items-center gap-3 text-[10px]">
        <span className="flex items-center gap-0.5">
          <Users className="h-2.5 w-2.5" />
          {thread.author}
        </span>
        <span className="flex items-center gap-0.5">
          <MessageSquare className="h-2.5 w-2.5" />
          {thread.replyCount} replies
        </span>
        <span className="flex items-center gap-0.5">
          <Eye className="h-2.5 w-2.5" />
          {thread.viewCount}
        </span>
      </div>
      <a
        href={forumUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-[10px] font-medium text-violet-500 transition-colors hover:text-violet-400"
      >
        Open thread <ExternalLink className="h-2.5 w-2.5" />
      </a>
    </div>
  );
}
