"use client";

import { List } from "iconoir-react";
import { Button } from "~/components/ui/button";

/** Distance kept between the viewport top and a heading we scroll to (clears the shell header). */
const SCROLL_TOP_OFFSET = 90;

/**
 * Header button that opens the Inspector sheet with the contents. Renders nothing for an article
 * without headings, and from 1280px up, where the Inspector already sits in the gutter.
 */
export function TocButton({ tocLength, onClick }: { tocLength: number; onClick?: () => void }) {
  if (tocLength <= 0 || !onClick) return null;
  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      onClick={onClick}
      title="Table of contents"
      aria-label="Table of contents"
      className="border-separator bg-surface text-label-secondary hover:text-label rounded-control gap-2 xl:hidden"
    >
      <List className="h-3.5 w-3.5" aria-hidden="true" />
      Contents
    </Button>
  );
}

/** Smooth-scrolls to a heading with the header's clearance kept, and records it in the URL hash. */
export function scrollToHeading(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - SCROLL_TOP_OFFSET;
  window.scrollTo({ top, behavior: "smooth" });
  window.history.replaceState(null, "", `#${id}`);
}
