"use client";

import { useEffect, useMemo, useRef } from "react";
import { WikiHtmlContent } from "~/components/wiki-os/reader/WikiLinkPreview";
import { formatThinkpagesContentForDisplay } from "~/lib/utils";
import { revealSpoilerFromEvent } from "~/lib/thinkpages/spoilers";

/**
 * A ThinkPages post's text, formatted for display, whose `||spoilers||` reveal on click, Enter or Space. One delegated
 * listener sits on a wrapper that draws no box (`contents`), so `className` styles the content itself.
 */
export function PostHtml({ content, className }: { content: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const html = useMemo(() => formatThinkpagesContentForDisplay(content), [content]);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    container.addEventListener("click", revealSpoilerFromEvent);
    container.addEventListener("keydown", revealSpoilerFromEvent);
    return () => {
      container.removeEventListener("click", revealSpoilerFromEvent);
      container.removeEventListener("keydown", revealSpoilerFromEvent);
    };
  }, []);

  return (
    <div ref={ref} className="contents">
      <WikiHtmlContent html={html} className={className} />
    </div>
  );
}
