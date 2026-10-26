"use client";

/**
 * GlobalLinkTooltips — Intercepts ALL link hovers across the entire app.
 *
 * Uses document-level event delegation to detect any <a> whose href is a wiki article WikiOS can preview
 * (`wikiLinkTarget`): an app link `/wiki/Title` under the base path (with `?source=` for a sister wiki), or an
 * absolute link to IxWiki, IIWiki or AltHistory (`/wiki/` or `index.php?title=`), portals and project pages included.
 * The preview (`WikiTooltipBody`) always resolves, and its link opens the article in WikiOS.
 *
 * Mount once in the root layout as a sibling (it wraps nothing) — every link gets
 * tooltips automatically, no per-component wrapping needed. Future wiki links
 * added anywhere in the app will automatically get tooltip coverage.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { VirtualAnchorHoverCard } from "~/components/ui/hover-card";
import { getBasePath } from "~/lib/base-path";
import { wikiLinkTarget, type WikiLinkTarget } from "~/lib/wiki-os/wiki-link-target";
import { WikiTooltipBody } from "./WikiTooltipBody";

export function GlobalLinkTooltips() {
  // The detected link and the <a> it came from (the hover card's virtual anchor). Kept after the
  // card closes so its content stays put during the exit animation.
  const [active, setActive] = useState<{ link: WikiLinkTarget; el: HTMLElement } | null>(null);
  const [open, setOpen] = useState(false);
  const showTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const activeElementRef = useRef<HTMLElement | null>(null);

  const show = useCallback((link: WikiLinkTarget, el: HTMLElement) => {
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

      const detected = wikiLinkTarget(href, getBasePath());
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
