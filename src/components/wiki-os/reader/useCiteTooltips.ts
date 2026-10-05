"use client";
// Hover tooltips for inline citations — shows footnote content on hover
// without needing to scroll to the references section.

import { useEffect, useState, useCallback, useRef, type RefObject } from "react";
import { createElement } from "react";
import { VirtualAnchorPopover } from "~/components/ui/popover";
import { useWikiSetting } from "~/components/wiki-os/shared/useWikiSetting";
import { useLinkTargetPreference } from "./useLinkTargetPreference";

interface TooltipState {
  html: string;
  /** The citation link the tooltip points at (a virtual anchor: found by delegation). */
  anchor: HTMLElement;
}

export function useCiteTooltips(contentRef: RefObject<HTMLElement | null>) {
  // The renderer wires its link preferences through this hook: "open links in a new tab" ...
  useLinkTargetPreference(contentRef);
  // ... and "citation tooltips" (Settings → WikiOS options).
  const enabled = useWikiSetting("wikios:showCitationTooltips", true);
  // Kept after closing so the content stays during the exit animation.
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [open, setOpen] = useState(false);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (el: HTMLElement) => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }

      // Get the cite_note id from the href
      const anchor = el.closest("a") as HTMLAnchorElement | null;
      if (!anchor) return;

      const href = anchor.getAttribute("href") ?? "";
      const match = href.match(/#(cite_note-.+)/);
      if (!match) return;

      const noteId = match[1];
      const container = contentRef.current;
      if (!container) return;

      // Find the footnote element in the page
      const noteEl = container.querySelector(`#${CSS.escape(noteId)}`);
      if (!noteEl) return;

      // Extract the reference text (skip the backlink)
      const clone = noteEl.cloneNode(true) as HTMLElement;
      // Remove backlinks (↑ arrows)
      clone.querySelectorAll(".mw-cite-backlink").forEach((el) => el.remove());
      const html = clone.innerHTML.trim();
      if (!html) return;

      // Shown above the reference link
      setTooltip({ html, anchor });
      setOpen(true);
    },
    [contentRef]
  );

  const hide = useCallback(() => {
    // mouseleave fires (capture) for the <a> and its <sup>; an uncleared first timer would still
    // close the tooltip after the pointer had moved onto it.
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    hideTimeoutRef.current = setTimeout(() => setOpen(false), 150);
  }, []);

  // Keep tooltip alive when hovering the tooltip itself
  const tooltipMouseEnter = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const tooltipMouseLeave = useCallback(() => {
    hide();
  }, [hide]);

  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;
    if (!enabled) return;

    const handleMouseEnter = (e: Event) => {
      const target = e.target as HTMLElement;
      const ref = target.closest("sup.reference");
      if (ref) show(target);
    };

    const handleMouseLeave = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.closest("sup.reference")) hide();
    };

    container.addEventListener("mouseenter", handleMouseEnter, true);
    container.addEventListener("mouseleave", handleMouseLeave, true);

    return () => {
      container.removeEventListener("mouseenter", handleMouseEnter, true);
      container.removeEventListener("mouseleave", handleMouseLeave, true);
    };
  }, [contentRef, show, hide, enabled]);

  // The tooltip: a popover above the citation (flips below near the top of the viewport). The
  // popover overlay is the only surface; the inner `.wikios-cite-tooltip-inner` just sets the
  // reading-face footnote type.
  return createElement(
    VirtualAnchorPopover,
    {
      anchor: tooltip?.anchor ?? null,
      open: open && enabled,
      onOpenChange: (next: boolean) => {
        if (!next) setOpen(false);
      },
      side: "top",
      sideOffset: 0,
      role: "tooltip",
      className: "z-tooltip max-w-[min(420px,90vw)] px-3.5 py-2.5",
      onMouseEnter: tooltipMouseEnter,
      onMouseLeave: tooltipMouseLeave,
    },
    tooltip
      ? createElement("div", {
          className: "wikios-cite-tooltip-inner",
          dangerouslySetInnerHTML: { __html: tooltip.html },
        })
      : null
  );
}
