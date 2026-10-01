"use client";
// src/components/wiki-os/reader/ImageLightbox.tsx
// Click hook for the article's images: opens the lightbox (ImageLightboxModal) on a click. The modal
// is a separate chunk, fetched on the first click, not with every article.

import React, { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  resolveHighResWikiImage,
  type HighResWikiImageResult,
} from "~/lib/wiki-os/transformers/resolve-highres-image";

const ImageLightboxModal = dynamic(
  () => import("./ImageLightboxModal").then((m) => m.ImageLightboxModal),
  { ssr: false }
);

/**
 * Hook: Attach to an article container ref to intercept image clicks and open the lightbox.
 */
export function useImageLightbox(containerRef: React.RefObject<HTMLElement | null>) {
  const [activeImage, setActiveImage] = useState<HighResWikiImageResult | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Don't intercept clicks inside floating toolbars or existing lightbox overlays
      if (
        target.closest(".wikios-lightbox-backdrop") ||
        target.closest(".wikios-annotation-popover")
      ) {
        return;
      }

      // Handle clicks on images or their enclosing link
      const img = target.closest("img") as HTMLImageElement | null;
      if (!img) return;

      const link = img.closest("a") as HTMLAnchorElement | null;

      // Ignore tiny utility icons
      const width = img.naturalWidth || img.width || parseInt(img.getAttribute("width") ?? "0", 10);
      const height =
        img.naturalHeight || img.height || parseInt(img.getAttribute("height") ?? "0", 10);
      if (width > 0 && width < 32 && height > 0 && height < 32 && !img.closest(".thumbinner")) {
        return;
      }

      // Prevent navigation to MediaWiki file page when clicking thumbnail
      e.preventDefault();
      e.stopPropagation();

      const resolved = resolveHighResWikiImage(img, link);
      setActiveImage(resolved);
    };

    container.addEventListener("click", handleClick, true);
    return () => container.removeEventListener("click", handleClick, true);
  }, [containerRef]);

  const handleClose = useCallback(() => setActiveImage(null), []);

  if (!activeImage || typeof document === "undefined") {
    return null;
  }

  return <ImageLightboxModal image={activeImage} onClose={handleClose} />;
}
