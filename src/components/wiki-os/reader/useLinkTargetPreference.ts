"use client";
// Settings → WikiOS options → "Open links in a new tab": when on, ordinary left-clicks on links in
// the article body open in a new tab. In-page anchors, citation and edit-section links, modified
// clicks and clicks another handler already took (the image lightbox) are left alone.

import { useEffect, type RefObject } from "react";
import { useWikiSetting } from "~/components/wiki-os/shared/useWikiSetting";

const SKIPPED = "sup.reference, .mw-cite-backlink, .mw-editsection";

export function useLinkTargetPreference(contentRef: RefObject<HTMLElement | null>) {
  const openInNewTab = useWikiSetting("wikios:openInNewTab", false);

  useEffect(() => {
    const container = contentRef.current;
    if (!container || !openInNewTab) return;

    const handleClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as HTMLElement).closest<HTMLAnchorElement>("a[href]");
      if (!link || !container.contains(link) || link.closest(SKIPPED)) return;
      const href = link.getAttribute("href") ?? "";
      if (!href || href.startsWith("#") || /^javascript:/i.test(href)) return;
      if (link.target === "_blank") return;

      e.preventDefault();
      window.open(link.href, "_blank", "noopener,noreferrer");
    };

    container.addEventListener("click", handleClick);
    return () => container.removeEventListener("click", handleClick);
  }, [contentRef, openInNewTab]);
}
