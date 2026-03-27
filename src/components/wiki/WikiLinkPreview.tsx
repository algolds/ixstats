"use client";

/**
 * WikiLinkPreview — Hover tooltip wrappers for wiki and forum links.
 *
 * NOTE: The GlobalLinkTooltipProvider (mounted in root layout) handles
 * ALL link tooltips via document-level event delegation. These components
 * are kept for backward compatibility but the global provider is the
 * primary tooltip system.
 *
 * Components:
 * 1. WikiLinkPreview — wraps a React element (legacy, still works)
 * 2. WikiHtmlContent — renders raw HTML safely (tooltips handled by global provider)
 * 3. ForumLinkPreview — wraps a React element (legacy, still works)
 */

import { useEffect } from "react";
import { api } from "~/trpc/react";
import { Tooltip } from "~/components/ui/tooltip-card";

// ──────────────────────────────────────────────
// WikiLinkPreview — for React element wrapping
// ──────────────────────────────────────────────

interface WikiLinkPreviewProps {
  title: string;
  wiki?: "ixwiki" | "iiwiki";
  children: React.ReactNode;
}

export function WikiLinkPreview({
  title,
  wiki = "ixwiki",
  children,
}: WikiLinkPreviewProps) {
  // Prefetch intro for instant tooltip via global provider
  const utils = api.useUtils();
  useEffect(() => {
    if (title) void utils.wiki.getIntro.prefetch({ title, wiki });
  }, [title, wiki, utils]);

  // Just render children — global provider handles the tooltip
  return <>{children}</>;
}

// ──────────────────────────────────────────────
// ForumLinkPreview — for React element wrapping
// ──────────────────────────────────────────────

interface ForumLinkPreviewProps {
  threadId: number;
  children: React.ReactNode;
}

export function ForumLinkPreview({
  threadId,
  children,
}: ForumLinkPreviewProps) {
  // Prefetch thread data for instant tooltip via global provider
  const utils = api.useUtils();
  useEffect(() => {
    if (threadId > 0) void utils.wiki.getForumThreadPreview.prefetch({ threadId });
  }, [threadId, utils]);

  return <>{children}</>;
}

// ──────────────────────────────────────────────
// WikiHtmlContent — renders raw HTML safely
// Tooltips are handled by the global provider
// ──────────────────────────────────────────────

interface WikiHtmlContentProps {
  html: string;
  className?: string;
  /** HTML tag to use for wrapper */
  as?: "div" | "p" | "span";
}

export function WikiHtmlContent({
  html,
  className = "",
  as: Tag = "div",
}: WikiHtmlContentProps) {
  return (
    <Tag
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// Re-export for backward compat
export { WikiHtmlContent as WikiContentRenderer };
