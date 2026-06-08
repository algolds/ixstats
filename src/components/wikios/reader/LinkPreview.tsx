// @ts-nocheck — Suppressed due to Zod v4 extended type inference gaps
// src/components/wikios/reader/LinkPreview.tsx
// Hover preview popup for wiki links in articles.
// Shows article intro on hover, handles redirects, uses client-side navigation.

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { navigateWithBasePath } from "~/lib/base-path";

// Show delay (ms) before tooltip appears — short enough to feel responsive
const SHOW_DELAY = 150;
// Hide delay (ms) after mouse leaves — short so it disappears quickly
const HIDE_DELAY = 80;

/**
 * Attach link preview behavior and client-side navigation to wiki links.
 */
export function useLinkPreviews(containerRef: React.RefObject<HTMLElement | null>) {
  const router = useRouter();
  const [preview, setPreview] = useState<{
    title: string;
    x: number;
    y: number;
  } | null>(null);

  const hideTimeout = useRef<ReturnType<typeof setTimeout>>();
  const showTimeout = useRef<ReturnType<typeof setTimeout>>();

  const clearTimers = useCallback(() => {
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
    if (showTimeout.current) clearTimeout(showTimeout.current);
  }, []);

  const showPreview = useCallback(
    (title: string, rect: DOMRect) => {
      clearTimers();
      showTimeout.current = setTimeout(() => {
        setPreview({
          title,
          x: rect.left + rect.width / 2,
          y: rect.bottom + 6,
        });
      }, SHOW_DELAY);
    },
    [clearTimers]
  );

  const hidePreview = useCallback(() => {
    clearTimers();
    hideTimeout.current = setTimeout(() => setPreview(null), HIDE_DELAY);
  }, [clearTimers]);

  const cancelHide = useCallback(() => {
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseEnter = (e: Event) => {
      const target = e.target as HTMLElement;
      const link = target.closest("a[href]") as HTMLAnchorElement | null;
      if (!link) return;

      const href = link.getAttribute("href") ?? "";
      const match = href.match(/\/w\/([^#?]+)/);
      if (!match) return;

      // Exclude non-prose areas and obvious UI/navigation links where UX is concerned
      if (
        link.closest(
          ".wikios-header, .wikios-categories, .wikios-category-link, .wikios-portal, " +
            ".wikios-portal-pill, .wikios-portal-card, .wikios-breadcrumb, .wikios-breadcrumb-link, " +
            ".wikios-tree-explorer, .wikios-tree-node, .wikios-tree-label, .wikios-tree-page-link, " +
            ".wikios-main-categories, .wikios-main-cat-pill, .wikios-main-recent, .wikios-main-world, " +
            ".wikios-main-world-card, .wikios-main-stats, .wikios-main-stat, " +
            ".wikios-article-footer, .wikios-notices, .wikios-infobox, .navbox, .wikios-navbox, " +
            ".wikios-quick-modal, .wikios-award-banner, [role='navigation'], " +
            ".reference, .cite-note, .wikios-rail, .wikios-sidebar"
        )
      ) {
        return;
      }

      const title = decodeURIComponent(match[1]!).replace(/_/g, " ");
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
      ) {
        return;
      }

      const rect = link.getBoundingClientRect();
      showPreview(title, rect);
    };

    const handleMouseLeave = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.closest("a[href]")) {
        hidePreview();
      }
    };

    // Intercept clicks on wiki links for client-side navigation
    const handleClick = (e: Event) => {
      const target = e.target as HTMLElement;
      const link = target.closest("a[href]") as HTMLAnchorElement | null;
      if (!link) return;

      const href = link.getAttribute("href") ?? "";
      const match = href.match(/\/w\/([^#?]+)/);
      if (!match) return;

      // Don't intercept Special:, File:, or external links
      const path = match[1]!;
      if (
        path.startsWith("Special:") ||
        path.startsWith("Special%3A") ||
        path.startsWith("File:") ||
        path.startsWith("File%3A")
      )
        return;

      // Client-side navigation instead of full page reload
      e.preventDefault();
      clearTimers();
      setPreview(null);
      navigateWithBasePath(`/w/${path}`, router);
    };

    container.addEventListener("mouseenter", handleMouseEnter, true);
    container.addEventListener("mouseleave", handleMouseLeave, true);
    container.addEventListener("click", handleClick, true);

    return () => {
      container.removeEventListener("mouseenter", handleMouseEnter, true);
      container.removeEventListener("mouseleave", handleMouseLeave, true);
      container.removeEventListener("click", handleClick, true);
      clearTimers();
    };
  }, [containerRef, showPreview, hidePreview, clearTimers, router]);

  if (!preview) return null;

  return createPortal(
    <LinkPreviewPopup
      title={preview.title}
      x={preview.x}
      y={preview.y}
      onMouseEnter={cancelHide}
      onMouseLeave={hidePreview}
    />,
    document.body
  );
}

// ---------------------------------------------------------------------------
// Preview popup component
// ---------------------------------------------------------------------------

function LinkPreviewPopup({
  title,
  x,
  y,
  onMouseEnter,
  onMouseLeave,
}: {
  title: string;
  x: number;
  y: number;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  // Single call — resolves redirects server-side, never shows "#REDIRECT"
  const { data } = api.wikios.getIntroResolved.useQuery({ title }, { staleTime: 60_000 });

  const displayTitle = data?.title ?? title;
  const displayText = data?.text ?? null;

  const style: React.CSSProperties = {
    position: "fixed",
    left: Math.max(16, Math.min(x - 160, window.innerWidth - 336)),
    top: Math.min(y, window.innerHeight - 200),
    zIndex: 10001,
  };

  return (
    <div
      className="wikios-link-preview"
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <h3 className="wikios-link-preview-title">{displayTitle}</h3>
      {displayText ? (
        <p className="wikios-link-preview-text">{displayText}</p>
      ) : (
        <p className="wikios-link-preview-text wikios-link-preview-loading">Loading...</p>
      )}
    </div>
  );
}
