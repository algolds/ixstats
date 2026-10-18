"use client";

/**
 * GlobalLinkTooltips — Intercepts ALL link hovers across the entire app.
 *
 * Uses document-level event delegation to detect any <a> pointing to:
 * - ixwiki.com/wiki/*       → Wiki article preview tooltip (the article opens in WikiOS)
 * - iiwiki.com/wiki/*       → IIWiki article preview tooltip (the article opens in WikiOS)
 *
 * Mount once in the root layout as a sibling (it wraps nothing) — every link gets
 * tooltips automatically, no per-component wrapping needed. Future wiki links
 * added anywhere in the app will automatically get tooltip coverage.
 */

import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import { Badge } from "~/components/ui/badge";
import { VirtualAnchorHoverCard } from "~/components/ui/hover-card";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";
import { OpenBook as BookOpen } from "iconoir-react";
import { WIKI_SOURCES, mediaWikiHostPattern, wikiReaderPath } from "~/lib/wiki-os/config";

/** A hovered link's wiki article. */
interface DetectedLink {
  title: string;
  wiki: "ixwiki" | "iiwiki";
}

/** Namespaces and special pages that have no useful preview. */
const NO_PREVIEW_TITLE = /^(?:(?:special|file|category)[:/]|(?:template|help|user|talk|wiki):)/i;

function wikiLink(match: RegExpMatchArray, wiki: "ixwiki" | "iiwiki"): DetectedLink | null {
  const title = decodeURIComponent(match[1]!).replace(/_/g, " ");
  return NO_PREVIEW_TITLE.test(title) ? null : { title, wiki };
}
/** An absolute link to an article of the wiki, by the configured public host. */
const ABSOLUTE_WIKI_LINK = new RegExp(
  `(?:https?:\\/\\/)?${mediaWikiHostPattern()}\\/wiki\\/([^#?]+)`
);

/** Parse a link href and return detection info, or null if not a recognized link */
function detectLink(href: string): DetectedLink | null {
  // Wiki links: <public host>/wiki/Title, /wiki/Title (relative), or /wiki/Title (WikiOS)
  const ixMatch =
    href.match(ABSOLUTE_WIKI_LINK) ??
    href.match(/^(?:\/[^/]+)?\/wiki\/([^#?]+)/) ??
    href.match(/^(?:\/[^/]+)?\/w\/([^#?]+)/);
  if (ixMatch) return wikiLink(ixMatch, "ixwiki");

  const iiMatch = href.match(/(?:https?:\/\/)?iiwiki\.(?:com|us)\/wiki\/([^#?]+)/);
  return iiMatch ? wikiLink(iiMatch, "iiwiki") : null;
}

export function GlobalLinkTooltips() {
  // The detected link and the <a> it came from (the hover card's virtual anchor). Kept after the
  // card closes so its content stays put during the exit animation.
  const [active, setActive] = useState<{ link: DetectedLink; el: HTMLElement } | null>(null);
  const [open, setOpen] = useState(false);
  const showTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const activeElementRef = useRef<HTMLElement | null>(null);

  const show = useCallback((link: DetectedLink, el: HTMLElement) => {
    clearTimeout(hideTimeoutRef.current);
    clearTimeout(showTimeoutRef.current);
    activeElementRef.current = el;
    showTimeoutRef.current = setTimeout(() => {
      setActive({ link, el });
      setOpen(true);
    }, 350);
  }, []);

  const hide = useCallback(() => {
    clearTimeout(showTimeoutRef.current);
    clearTimeout(hideTimeoutRef.current);
    hideTimeoutRef.current = setTimeout(() => {
      setOpen(false);
      activeElementRef.current = null;
    }, 200);
  }, []);

  const keepOpen = useCallback(() => clearTimeout(hideTimeoutRef.current), []);

  useEffect(() => {
    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest("a[href]") as HTMLAnchorElement | null;
      if (!link) return;

      // Don't show tooltip for links inside another tooltip, the wiki sidebar, or WikiOS shells
      if (link.closest(".global-link-tooltip, .no-wiki-tooltip, .wikios-root, .wikios-shell"))
        return;

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
      clearTimeout(showTimeoutRef.current);
      clearTimeout(hideTimeoutRef.current);
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
      {active ? <WikiTooltipBody title={active.link.title} wiki={active.link.wiki} /> : null}
    </VirtualAnchorHoverCard>
  );
}

function WikiTooltipBody({ title, wiki }: { title: string; wiki: "ixwiki" | "iiwiki" }) {
  const { data: intro } = api.wikios.getIntro.useQuery({ title, wiki }, { staleTime: 30 * 60_000 });

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <BookOpen className="text-tint size-3.5 shrink-0" aria-hidden="true" />
        <span className="text-label text-headline truncate">{title}</span>
        <Badge variant="default" className="ml-auto">
          {WIKI_SOURCES[wiki].name}
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
      <Link
        href={wikiReaderPath(title, wiki)}
        className="text-caption text-tint hover:text-tint-hover flex items-center gap-1 transition-colors"
      >
        Read full article
      </Link>
    </div>
  );
}
