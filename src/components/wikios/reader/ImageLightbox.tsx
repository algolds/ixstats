// src/components/wikios/reader/ImageLightbox.tsx
// Lightbox modal for viewing wiki images at full size.
// Intercepts clicks on image links within articles.

"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, ExternalLink, ZoomIn, ZoomOut } from "lucide-react";

interface LightboxImage {
  src: string;
  alt: string;
  fileUrl: string;
}

/**
 * Hook: attach to an article container ref to intercept image clicks.
 * Returns a portal element to render in the component tree.
 */
export function useImageLightbox(containerRef: React.RefObject<HTMLElement | null>) {
  const [image, setImage] = useState<LightboxImage | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleClick = (e: Event) => {
      const target = e.target as HTMLElement;

      // Only handle clicks on images or their parent links
      const img = target.closest("img") as HTMLImageElement | null;
      if (!img) return;

      const link = img.closest("a.mw-file-description, a[href*='/wiki/File:'], a[href*='/w/File:']");
      if (!link) return;

      // Don't intercept infobox flag/coa images (too small to lightbox)
      const width = img.width || parseInt(img.getAttribute("width") ?? "0", 10);
      if (width < 80) return;

      e.preventDefault();
      e.stopPropagation();

      // Get the full-size image URL — strip the thumbnail path to get original
      let fullSrc = img.getAttribute("src") ?? "";
      // Transform thumbnail URL to full size: /thumb/a/ab/File.png/300px-File.png → /a/ab/File.png
      const thumbMatch = fullSrc.match(/\/thumb(\/[^/]+\/[^/]+\/[^/]+)\//);
      if (thumbMatch) {
        fullSrc = fullSrc.replace(/\/thumb(\/[^/]+\/[^/]+\/[^/]+)\/[^/]+$/, "$1");
      }

      const fileUrl = (link as HTMLAnchorElement).getAttribute("href") ?? "";

      setImage({
        src: fullSrc,
        alt: img.getAttribute("alt") ?? "",
        fileUrl,
      });
    };

    container.addEventListener("click", handleClick, true);
    return () => container.removeEventListener("click", handleClick, true);
  }, [containerRef]);

  const close = useCallback(() => setImage(null), []);

  if (!image) return null;

  return createPortal(
    <LightboxModal image={image} onClose={close} />,
    document.body
  );
}

// ---------------------------------------------------------------------------
function LightboxModal({ image, onClose }: { image: LightboxImage; onClose: () => void }) {
  const [zoomed, setZoomed] = useState(false);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div className="wikios-lightbox-overlay" onClick={onClose}>
      <div className="wikios-lightbox-content" onClick={(e) => e.stopPropagation()}>
        {/* Controls */}
        <div className="wikios-lightbox-controls">
          <span className="wikios-lightbox-alt">{image.alt}</span>
          <div className="wikios-lightbox-buttons">
            <button
              onClick={() => setZoomed(!zoomed)}
              className="wikios-lightbox-btn"
              title={zoomed ? "Zoom out" : "Zoom in"}
            >
              {zoomed ? <ZoomOut className="h-4 w-4" /> : <ZoomIn className="h-4 w-4" />}
            </button>
            {image.fileUrl && (
              <a
                href={image.fileUrl.startsWith("/") ? `https://ixwiki.com${image.fileUrl}` : image.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="wikios-lightbox-btn"
                title="View file page"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
            <button onClick={onClose} className="wikios-lightbox-btn" title="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Image */}
        <div className={`wikios-lightbox-image-wrapper ${zoomed ? "wikios-lightbox-zoomed" : ""}`}>
          <img
            src={image.src}
            alt={image.alt}
            className="wikios-lightbox-image"
            referrerPolicy="no-referrer"
            onClick={() => setZoomed(!zoomed)}
          />
        </div>
      </div>
    </div>
  );
}
