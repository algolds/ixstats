// src/components/wiki-os/reader/useCiteTooltips.ts
// Hover tooltips for inline citations — shows footnote content on hover
// without needing to scroll to the references section.

"use client";

import { useEffect, useState, useCallback, useRef, type RefObject } from "react";
import { createPortal } from "react-dom";
import { createElement } from "react";

interface TooltipState {
  html: string;
  x: number;
  y: number;
}

export function useCiteTooltips(contentRef: RefObject<HTMLElement | null>) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
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

      // Position tooltip above the reference link
      const rect = anchor.getBoundingClientRect();
      setTooltip({
        html,
        x: rect.left + rect.width / 2,
        y: rect.top,
      });
    },
    [contentRef]
  );

  const hide = useCallback(() => {
    hideTimeoutRef.current = setTimeout(() => setTooltip(null), 150);
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
  }, [contentRef, show, hide]);

  // Render the tooltip portal
  const portal = tooltip
    ? createPortal(
        createElement(
          "div",
          {
            className: "wikios-cite-tooltip",
            style: {
              left: `${tooltip.x}px`,
              top: `${tooltip.y}px`,
            },
            onMouseEnter: tooltipMouseEnter,
            onMouseLeave: tooltipMouseLeave,
          },
          createElement("div", {
            className: "wikios-cite-tooltip-inner",
            dangerouslySetInnerHTML: { __html: tooltip.html },
          })
        ),
        document.body
      )
    : null;

  return portal;
}
