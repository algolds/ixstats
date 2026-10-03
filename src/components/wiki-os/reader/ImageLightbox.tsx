"use client";
// src/components/wiki-os/reader/ImageLightbox.tsx
// Immersive Apple Quick Look & Repository UI/UX Lightbox Modal for WikiOS.
// Features a unified frame where the Repository Inspector is physically bolted directly to the image,
// bottom-docked Facet glass controls, high-resolution original asset resolution, Wikitext generator, and fluid spring physics.

import { cn } from "~/lib/utils";
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Xmark as X,
  OpenNewWindow as ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCameraLeft as RotateCcw,
  Download,
  MediaImage as FileImage,
  InfoCircle as Info,
  Copy,
  Check,
  Bookmark,
  Sparks as Sparkles,
} from "iconoir-react";
import { useWikiMediaTheme } from "~/components/wiki-os/shared/MediaThemeContext";
import { detectMediaType, type MediaType } from "~/lib/wiki-os/transformers/media-theme";
import {
  resolveHighResWikiImage,
  type HighResWikiImageResult,
} from "~/lib/wiki-os/transformers/resolve-highres-image";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";

/** Round dock action (reset, download, file page, inspector). */
const LIGHTBOX_ACTION = "border-separator rounded-full border";

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

// ---------------------------------------------------------------------------
// Main Lightbox Modal Component
// ---------------------------------------------------------------------------

function ImageLightboxModal({
  image,
  onClose,
}: {
  image: HighResWikiImageResult;
  onClose: () => void;
}) {
  const [scale, setScale] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string>(image.highResSrc);
  const [isClosing, setIsClosing] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);
  const [imgNaturalSize, setImgNaturalSize] = useState<{ width: number; height: number } | null>(
    null
  );

  const { user } = useUser();
  const isAuthenticated = !!user;
  const stashMutation = api.wikios.stashPage.useMutation();

  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number }>({
    x: 0,
    y: 0,
    panX: 0,
    panY: 0,
  });

  const { getImageStyle } = useWikiMediaTheme();

  const isSvg = useMemo(() => {
    return (
      image.isSvg ||
      currentSrc.toLowerCase().includes(".svg") ||
      currentSrc.toLowerCase().includes("format=svg") ||
      image.filename.toLowerCase().endsWith(".svg")
    );
  }, [image.isSvg, currentSrc, image.filename]);

  const isTransparent = useMemo(() => {
    const lowerSrc = currentSrc.toLowerCase();
    const lowerFile = image.filename.toLowerCase();
    return (
      isSvg ||
      lowerFile.endsWith(".png") ||
      lowerFile.endsWith(".webp") ||
      lowerSrc.includes(".png") ||
      lowerSrc.includes(".webp") ||
      lowerSrc.includes("diagram") ||
      lowerSrc.includes("seal") ||
      lowerSrc.includes("coat_of_arms") ||
      lowerSrc.includes("emblem") ||
      lowerSrc.includes("logo") ||
      lowerSrc.includes("flag")
    );
  }, [isSvg, image.filename, currentSrc]);

  const mediaType = useMemo<MediaType>(() => {
    if (isSvg) return "svg";
    return detectMediaType(currentSrc);
  }, [isSvg, currentSrc]);

  const imageFilterStyle = useMemo(() => {
    return getImageStyle(currentSrc, mediaType);
  }, [getImageStyle, currentSrc, mediaType]);

  // Synchronize state when image prop changes
  useEffect(() => {
    // oxlint-disable-next-line
    setCurrentSrc(image.highResSrc);
    setScale(1);
    setPan({ x: 0, y: 0 });
    setIsClosing(false);
    setShowInspector(false);
    setCopiedFormat(null);
    setImgNaturalSize(null);
  }, [image]);

  // Smooth Close Handler
  const triggerClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 160);
  }, [onClose]);

  // Reset zoom & pan
  const handleResetZoom = useCallback(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Zoom step
  const handleZoomChange = useCallback((delta: number) => {
    setScale((prev) => {
      const next = Math.min(4, Math.max(0.5, Math.round((prev + delta) * 100) / 100));
      if (next === 1) {
        setPan({ x: 0, y: 0 });
      }
      return next;
    });
  }, []);

  // Toggle 1x ↔ 2x
  const handleToggle2x = useCallback(() => {
    setScale((prev) => {
      if (prev > 1) {
        setPan({ x: 0, y: 0 });
        return 1;
      }
      return 2;
    });
  }, []);

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const zoomFactor = e.deltaY < 0 ? 0.2 : -0.2;
    setScale((prev) => {
      const next = Math.min(4, Math.max(0.5, Math.round((prev + zoomFactor) * 10) / 10));
      if (next === 1) {
        setPan({ x: 0, y: 0 });
      }
      return next;
    });
  }, []);

  // Pointer drag for panning when zoomed
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (scale <= 1) return;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setIsDragging(true);
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        panX: pan.x,
        panY: pan.y,
      };
    },
    [scale, pan]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || scale <= 1) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setPan({
        x: dragStartRef.current.panX + dx,
        y: dragStartRef.current.panY + dy,
      });
    },
    [isDragging, scale]
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Keyboard navigation & shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      // Escape is handled by the Dialog (onEscapeKeyDown closes the inspector first).
      if (e.key === "+" || e.key === "=") {
        handleZoomChange(0.25);
      } else if (e.key === "-" || e.key === "_") {
        handleZoomChange(-0.25);
      } else if (e.key === "0") {
        handleResetZoom();
      } else if (e.key.toLowerCase() === "z" || e.key.toLowerCase() === "f") {
        handleToggle2x();
      } else if (e.key.toLowerCase() === "i") {
        setShowInspector((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleZoomChange, handleResetZoom, handleToggle2x]);

  // Format file extension badge
  const fileExt = useMemo(() => {
    const ext = image.filename.split(".").pop()?.toUpperCase() || (image.isSvg ? "SVG" : "IMAGE");
    return ext.length <= 4 ? ext : "IMG";
  }, [image.filename, image.isSvg]);

  const cleanTitle = useMemo(() => {
    return image.filename.replace(/^File:/, "").replace(/_/g, " ");
  }, [image.filename]);

  // Copy Wikitext helper
  const handleCopyFormat = useCallback(
    (format: "thumb" | "embed" | "raw" | "url") => {
      let text = "";
      if (format === "thumb") {
        text = `[[File:${cleanTitle}|thumb|${cleanTitle}]]`;
      } else if (format === "embed") {
        text = `[[File:${cleanTitle}|250px]]`;
      } else if (format === "raw") {
        text = `[[File:${cleanTitle}]]`;
      } else if (format === "url") {
        text = currentSrc;
      }
      navigator.clipboard.writeText(text);
      setCopiedFormat(format);
      setTimeout(() => setCopiedFormat(null), 2000);
    },
    [cleanTitle, currentSrc]
  );

  // Stash handler
  const handleStash = useCallback(() => {
    const isLocal = image.fileUrl?.includes("ixwiki.com");
    const isIiwiki = image.fileUrl?.includes("iiwiki.com");
    let title = `commons:File:${cleanTitle}`;
    if (isLocal) {
      title = `File:${cleanTitle}`;
    } else if (isIiwiki) {
      title = `iiwiki:File:${cleanTitle}`;
    }
    stashMutation.mutate({ pageTitle: title });
  }, [image.fileUrl, cleanTitle, stashMutation]);

  return (
    // Full-screen image viewer (spec §7.3): a Dialog with instant presentation — the fade below is
    // the transition. The content fills the viewport over a dark photo backdrop.
    <Dialog open onOpenChange={(open) => !open && triggerClose()}>
      <DialogContent
        presentation="instant"
        showCloseButton={false}
        aria-describedby={undefined}
        onEscapeKeyDown={(e) => {
          if (showInspector) {
            e.preventDefault();
            setShowInspector(false);
          }
        }}
        onClick={triggerClose}
        onWheel={handleWheel}
        className={cn(
          "wikios-lightbox-backdrop text-label inset-0 top-0 left-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-row gap-0 rounded-none border-0 bg-black/85 p-0 shadow-none sm:max-w-none",
          isClosing ? "wikios-lightbox-closing" : "wikios-lightbox-entering"
        )}
      >
        <DialogTitle className="sr-only">{cleanTitle}</DialogTitle>
        {/* Top-right dismiss button (Esc) */}
        <div className="z-raised absolute top-4 right-4 sm:top-5 sm:right-6">
          <Button
            variant="outline"
            size="sm"
            onClick={triggerClose}
            className="bg-surface-elevated shadow-card hover:border-red/40 hover:bg-red/15 hover:text-red rounded-full"
            title="Dismiss Lightbox (Esc)"
            aria-label="Close"
          >
            <X className="size-4" aria-hidden="true" />
            <span className="text-caption text-label-secondary">Esc</span>
          </Button>
        </div>

        {/* Main Viewport Stage */}
        <div
          className={`wikios-lightbox-viewport ${
            scale > 1 ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in"
          }`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onDoubleClick={handleToggle2x}
          onClick={(e) => {
            if (e.target === e.currentTarget && scale === 1) {
              triggerClose();
            }
          }}
        >
          {/* Canvas wrapper for scale and pan */}
          <div
            className="wikios-lightbox-canvas"
            style={{
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${scale})`,
              transition: isDragging ? "none" : "transform 180ms cubic-bezier(0.23, 1, 0.32, 1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Unified Bolted Frame (Image + Bolted Inspector Wing) */}
            <div
              className={`wikios-lightbox-bolted-frame ${
                showInspector ? "wikios-lightbox-bolted-frame--open" : ""
              }`}
            >
              {/* Left: Image Container */}
              <div
                className={`wikios-lightbox-img-wrapper ${
                  isTransparent ? "wikios-lightbox-img-wrapper--transparent" : ""
                } ${isSvg ? "wikios-lightbox-img-wrapper--svg" : ""}`}
              >
                <img
                  src={currentSrc}
                  alt={image.alt || image.filename}
                  className="wikios-lightbox-img-master"
                  style={imageFilterStyle}
                  onLoad={(e) => {
                    const target = e.currentTarget;
                    setImgNaturalSize({
                      width: target.naturalWidth,
                      height: target.naturalHeight,
                    });
                  }}
                  onError={() => {
                    // If high-res static URL 404s, fallback safely to thumbnail
                    if (currentSrc !== image.thumbSrc && image.thumbSrc) {
                      setCurrentSrc(image.thumbSrc);
                    }
                  }}
                  referrerPolicy="no-referrer"
                  draggable={false}
                />
              </div>

              {/* Right: Bolted Inspector Wing (Physically connected with 0 gap) */}
              {showInspector && (
                <aside className="wikios-lightbox-bolted-wing">
                  {/* Header */}
                  <div className="wikios-lightbox-flank-header">
                    <div className="flex min-w-0 items-center gap-2">
                      <Sparkles className="text-yellow h-3.5 w-3.5 shrink-0" />
                      <h3 className="text-subhead text-label truncate">Media Details</h3>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setShowInspector(false)}
                      className="text-label-secondary rounded-full"
                      title="Close Inspector"
                      aria-label="Close inspector"
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>

                  {/* Body */}
                  <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                    {/* File Details Card */}
                    <div className="wikios-lightbox-flank-box">
                      <span className="wikios-lightbox-side-label">File Details</span>
                      <p className="text-caption text-label mt-1 font-semibold break-words">
                        {cleanTitle}
                      </p>
                      {imgNaturalSize && (
                        <div className="text-footnote text-label-secondary mt-2 flex items-center gap-2">
                          <span className="wikios-lightbox-badge">{fileExt}</span>
                          <span>
                            {imgNaturalSize.width} × {imgNaturalSize.height} px
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Wikitext Copy Generator */}
                    <div className="wikios-lightbox-flank-box">
                      <span className="wikios-lightbox-side-label">Wikitext Formats</span>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {(["thumb", "embed", "raw", "url"] as const).map((fmt) => (
                          <Button
                            key={fmt}
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopyFormat(fmt)}
                            className="bg-fill-4 justify-start gap-1"
                          >
                            {copiedFormat === fmt ? (
                              <Check className="text-green h-3.5 w-3.5 shrink-0" />
                            ) : (
                              <Copy className="h-3.5 w-3.5 shrink-0 opacity-60" />
                            )}
                            <span className="truncate">
                              {fmt === "thumb"
                                ? "Thumb"
                                : fmt === "embed"
                                  ? "250px"
                                  : fmt === "raw"
                                    ? "Raw"
                                    : "URL"}
                            </span>
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Stash Action */}
                    {isAuthenticated && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleStash}
                        disabled={stashMutation.isPending || stashMutation.isSuccess}
                        className="bg-green/10 text-green hover:bg-green/20 w-full"
                      >
                        <Bookmark
                          className={cn(
                            "h-3.5 w-3.5",
                            stashMutation.isSuccess && "fill-green text-green"
                          )}
                        />
                        <span>
                          {stashMutation.isSuccess
                            ? "Saved to Stash"
                            : stashMutation.isPending
                              ? "Stashing..."
                              : "Bookmark in Stash"}
                        </span>
                      </Button>
                    )}

                    {/* External Description Link */}
                    {image.fileUrl && (
                      <div className="pt-0.5">
                        <a
                          href={
                            image.fileUrl.startsWith("/")
                              ? `https://ixwiki.com${image.fileUrl}`
                              : image.fileUrl
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="wikios-lightbox-side-link"
                        >
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          <span>View description page</span>
                        </a>
                      </div>
                    )}
                  </div>
                </aside>
              )}
            </div>
          </div>
        </div>

        {/* Floating Bottom Facet Control Dock */}
        <div className="wikios-lightbox-bottom-dock" onClick={(e) => e.stopPropagation()}>
          {/* Left: File metadata chip */}
          <div className="flex min-w-0 items-center gap-2 pr-2">
            <div className="wikios-lightbox-badge flex items-center gap-1">
              <FileImage className="h-3 w-3 opacity-70" />
              <span>{fileExt}</span>
            </div>
            <span className="wikios-lightbox-title text-caption max-w-[120px] truncate sm:max-w-[200px]">
              {cleanTitle}
            </span>
          </div>

          <div className="wikios-lightbox-v-divider" />

          {/* Center: Zoom Segmented Controls */}
          <div className="wikios-lightbox-segmented-group">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => handleZoomChange(-0.25)}
              disabled={scale <= 0.5}
              className="rounded-full"
              title="Zoom out (-)"
              aria-label="Zoom out"
            >
              <ZoomOut className="size-3.5" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggle2x}
              className="text-caption min-w-12 rounded-full px-2 font-semibold tabular-nums"
              title="Toggle 1x / 2x zoom (Z)"
            >
              <span>{Math.round(scale * 100)}%</span>
            </Button>

            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => handleZoomChange(0.25)}
              disabled={scale >= 4}
              className="rounded-full"
              title="Zoom in (+)"
              aria-label="Zoom in"
            >
              <ZoomIn className="size-3.5" />
            </Button>
          </div>

          {/* Reset Zoom */}
          {scale !== 1 && (
            <Button
              variant="secondary"
              size="icon-sm"
              onClick={handleResetZoom}
              className={LIGHTBOX_ACTION}
              title="Reset zoom (0)"
              aria-label="Reset zoom"
            >
              <RotateCcw className="size-3.5" />
            </Button>
          )}

          <div className="wikios-lightbox-v-divider" />

          {/* Right Action Icons */}
          <div className="flex items-center gap-1">
            {/* Direct Download */}
            <Button asChild variant="secondary" size="icon-sm" className={LIGHTBOX_ACTION}>
              <a
                href={currentSrc}
                download={image.filename || "wiki-image"}
                target="_blank"
                rel="noreferrer"
                title="Download full-resolution original"
                aria-label="Download original"
              >
                <Download className="size-3.5" />
              </a>
            </Button>

            {/* External File Description Page */}
            {image.fileUrl && (
              <Button asChild variant="secondary" size="icon-sm" className={LIGHTBOX_ACTION}>
                <a
                  href={
                    image.fileUrl.startsWith("/")
                      ? `https://ixwiki.com${image.fileUrl}`
                      : image.fileUrl
                  }
                  target="_blank"
                  rel="noreferrer"
                  title="Inspect MediaWiki File Description Page"
                  aria-label="Open file description page"
                >
                  <ExternalLink className="size-3.5" />
                </a>
              </Button>
            )}

            {/* Repository Inspector / Info Drawer Toggle */}
            <Button
              variant={showInspector ? "secondary" : "secondary"}
              size="icon-sm"
              aria-pressed={showInspector}
              onClick={() => setShowInspector((prev) => !prev)}
              className={cn(LIGHTBOX_ACTION, showInspector && "border-tint/50")}
              title="Toggle Repository Info & Wikitext Inspector (I)"
              aria-label="Media details"
            >
              <Info className="size-3.5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
