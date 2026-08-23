// src/components/wiki-os/stashes/StashImagesGrid.tsx
// Saved Wikimedia Commons media grid with interactive lightbox modal.

"use client";

import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  ZoomIn,
  SystemRestart as Loader2,
  Xmark as X,
  Copy,
  Check,
  MediaImage as ImageIcon,
  Download,
  Trash as Trash2,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import type { CommonsImage } from "./types";

interface StashedItemMedia {
  id: string;
  pageTitle: string;
}

interface StashImagesGridProps {
  items: StashedItemMedia[];
  resolvedImagesMap: Map<string, CommonsImage>;
  onUnstash: (pageTitle: string) => void;
}

export function StashImagesGrid({ items, resolvedImagesMap, onUnstash }: StashImagesGridProps) {
  const [selectedImage, setSelectedImage] = useState<CommonsImage | null>(null);

  return (
    <>
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => {
          const imgInfo = resolvedImagesMap.get(item.pageTitle);
          const cleanTitle = item.pageTitle
            .replace(/^commons:File:/, "")
            .replace(/_/g, " ");

          return (
            <div
              key={item.id}
              className="group relative cursor-pointer overflow-hidden rounded-2xl border border-[var(--wikios-border)] bg-[var(--wikios-card-bg)]/80 hover:bg-[var(--wikios-surface)]/90 hover:border-[var(--wikios-border)]/80 shadow-xs hover:shadow-md transition-all duration-200 backdrop-blur-xl flex flex-col"
              onClick={() => imgInfo && setSelectedImage(imgInfo)}
            >
              <div className="relative aspect-4/3 w-full overflow-hidden bg-white/5 border-b border-[var(--wikios-border)]/60">
                {imgInfo ? (
                  <img
                    src={imgInfo.thumbUrl}
                    alt={cleanTitle}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin opacity-40" />
                  </div>
                )}

                {/* Hover overlay button */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white backdrop-blur-2xs">
                  <div className="h-8 w-8 rounded-full bg-white/20 border border-white/40 flex items-center justify-center shadow-md">
                    <ZoomIn className="h-4 w-4" />
                  </div>
                </div>

                {/* Remove button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUnstash(item.pageTitle);
                  }}
                  className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-lg border border-white/20 bg-black/60 text-white opacity-0 transition-all group-hover:opacity-100 hover:bg-rose-500/80 hover:border-rose-500 shadow-xs"
                  title="Remove from stash"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>

              <div className="p-2.5 flex flex-col justify-between gap-1 flex-1">
                <span className="text-xs font-bold text-[var(--wikios-text)] group-hover:text-[var(--wikios-accent)] transition-colors truncate" title={cleanTitle}>
                  {cleanTitle}
                </span>
                <span className="text-[10px] text-[var(--wikios-text-dim)] font-mono">
                  {imgInfo ? `${imgInfo.width} × ${imgInfo.height}` : "..."}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {selectedImage && (
        <StashedImageModal
          image={selectedImage}
          onClose={() => setSelectedImage(null)}
          onUnstash={() => {
            onUnstash(`commons:${selectedImage.title}`);
            setSelectedImage(null);
          }}
        />
      )}
    </>
  );
}

export function StashedImageModal({
  image,
  onClose,
  onUnstash,
}: {
  image: CommonsImage;
  onClose: () => void;
  onUnstash: () => void;
}) {
  const [format, setFormat] = useState<"thumb" | "embed" | "raw" | "url">("thumb");
  const [copied, setCopied] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const [isCopyingImage, setIsCopyingImage] = useState(false);
  const utils = api.useUtils();

  const cleanTitle = image.title.replace(/^File:/, "").replace(/_/g, " ");

  const handleCopyImage = async () => {
    setIsCopyingImage(true);
    try {
      let blob: Blob;
      try {
        const response = await fetch(image.url);
        if (!response.ok) throw new Error("CORS or direct fetch failed");
        blob = await response.blob();
      } catch (directErr) {
        console.warn("Direct fetch failed, falling back to server download:", directErr);
        const cleanName = image.title.replace(/^File:/, "");
        const res = await utils.wikios.downloadFile.fetch({ filename: cleanName });
        if (!res || !res.content) {
          throw new Error("Failed to download image from server");
        }
        const byteCharacters = atob(res.content);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        blob = new Blob([byteArray], { type: res.mime || "image/png" });
      }

      const imgEl = new window.Image();
      const objectUrl = URL.createObjectURL(blob);
      imgEl.src = objectUrl;

      await new Promise((resolve, reject) => {
        imgEl.onload = resolve;
        imgEl.onerror = () => reject(new Error("Failed to load image element"));
      });

      const canvas = document.createElement("canvas");
      canvas.width = imgEl.naturalWidth || imgEl.width;
      canvas.height = imgEl.naturalHeight || imgEl.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        throw new Error("Could not get canvas context");
      }
      ctx.drawImage(imgEl, 0, 0);
      URL.revokeObjectURL(objectUrl);

      const pngBlob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), "image/png");
      });
      if (!pngBlob) throw new Error("Failed to convert image to PNG");

      await navigator.clipboard.write([
        new ClipboardItem({
          "image/png": pngBlob,
        }),
      ]);

      setCopiedImage(true);
      setTimeout(() => setCopiedImage(false), 2000);
    } catch (err) {
      console.error("Failed to copy image:", err);
      alert("Failed to copy image to clipboard. Try downloading it instead.");
    } finally {
      setIsCopyingImage(false);
    }
  };

  const formatText = useMemo(() => {
    switch (format) {
      case "thumb":
        return `[[${image.title}|thumb|${cleanTitle}]]`;
      case "embed":
        return `[[${image.title}|250px]]`;
      case "raw":
        return `[[${image.title}]]`;
      case "url":
        return image.url;
    }
  }, [format, image, cleanTitle]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  return createPortal(
    <div
      className="animate-in fade-in fixed inset-0 z-[120002] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md duration-200"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 cursor-pointer rounded-full border border-[var(--wikios-border)] bg-[var(--wikios-surface)]/80 p-2.5 text-[var(--wikios-text)] transition-all hover:bg-[var(--wikios-border)]"
        title="Close Lightbox"
        type="button"
      >
        <X className="h-5 w-5" />
      </button>

      <div
        className="animate-in zoom-in-95 relative flex max-h-[95vh] w-full max-w-4xl flex-col gap-6 rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-surface)] p-6 shadow-2xl backdrop-blur-xl duration-200 md:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left: Image Container */}
        <div
          className="group relative flex min-h-[300px] flex-1 cursor-zoom-in items-center justify-center overflow-hidden rounded-lg border border-[var(--wikios-border)] bg-[var(--wikios-bg)]/40 md:min-h-0"
          onClick={() => setIsZoomed(true)}
          title="Click to view fullscreen"
        >
          <img
            src={image.url}
            alt={cleanTitle}
            className="max-h-[50vh] max-w-full rounded object-contain transition-transform duration-200 group-hover:scale-[1.01] md:max-h-[70vh]"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-200 group-hover:bg-black/30">
            <div className="rounded-full bg-black/60 p-3 text-white opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100">
              <ZoomIn className="h-6 w-6" />
            </div>
          </div>
        </div>

        {/* Right: Info and Actions */}
        <div className="flex w-full flex-col justify-between gap-4 md:w-80">
          <div className="flex flex-col gap-3">
            <div>
              <span className="text-[10px] font-bold tracking-wider text-[var(--wikios-accent)] uppercase">
                Stashed Media
              </span>
              <h2 className="mt-0.5 text-lg leading-tight font-bold break-words text-[var(--wikios-text)]">
                {cleanTitle}
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-y-1 border-y border-[var(--wikios-border)] py-3 text-xs text-[var(--wikios-text-dim)]">
              <div>Dimensions:</div>
              <div className="text-right text-[var(--wikios-text-muted)]">
                {image.width} × {image.height}
              </div>
              <div>Type:</div>
              <div className="text-right text-[var(--wikios-text-muted)]">
                {image.mime.split("/")[1]?.toUpperCase() ?? "Unknown"}
              </div>
              {image.license && (
                <>
                  <div>License:</div>
                  <div
                    className="truncate text-right text-[var(--wikios-text-muted)]"
                    title={image.license}
                  >
                    {image.license}
                  </div>
                </>
              )}
            </div>

            {/* Wikitext formats */}
            <div>
              <span className="mb-1.5 block text-[9px] font-bold tracking-wider text-[var(--wikios-text-dim)] uppercase">
                Wikitext Copy Format
              </span>
              <div className="wikios-filter-group grid grid-cols-4">
                {(["thumb", "embed", "raw", "url"] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setFormat(fmt)}
                    className={cn(
                      "wikios-filter-btn",
                      format === fmt && "wikios-filter-btn--active"
                    )}
                  >
                    {fmt === "thumb"
                      ? "Thumb"
                      : fmt === "embed"
                        ? "Embed"
                        : fmt === "raw"
                          ? "File"
                          : "URL"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="col-span-2 flex items-center justify-center gap-1.5 rounded-lg bg-[var(--wikios-accent)] py-2 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied!" : format === "url" ? "Copy URL" : "Copy Wikitext"}
              </button>
              <button
                type="button"
                onClick={handleCopyImage}
                disabled={isCopyingImage}
                className="col-span-1 flex items-center justify-center gap-1.5 rounded-lg border border-[var(--wikios-border)] bg-[var(--wikios-surface)] py-2 text-sm font-semibold text-[var(--wikios-text)] transition-all hover:bg-[var(--wikios-border)] active:scale-[0.98] disabled:opacity-50"
                title="Copy Image to Clipboard"
              >
                {isCopyingImage ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : copiedImage ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <ImageIcon className="h-4 w-4" />
                )}
                {copiedImage ? "Copied!" : "Image"}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => window.open(image.url, "_blank")}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--wikios-border)] bg-[var(--wikios-surface)] py-2 text-xs font-semibold text-[var(--wikios-text)] transition-all hover:bg-[var(--wikios-border)]"
              >
                <Download className="h-3.5 w-3.5" /> Download
              </button>
              <button
                type="button"
                onClick={onUnstash}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 py-2 text-xs font-semibold text-red-500 transition-all hover:bg-red-500/20 dark:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" /> Unstash
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Full Screen Image Lightbox */}
      {isZoomed && (
        <div
          className="animate-in fade-in fixed inset-0 z-[120003] flex cursor-zoom-out items-center justify-center bg-black/95 backdrop-blur-md duration-200"
          onClick={() => setIsZoomed(false)}
        >
          <button
            onClick={() => setIsZoomed(false)}
            className="absolute top-4 right-4 cursor-pointer rounded-full border border-white/10 bg-white/10 p-2.5 text-white transition-all hover:bg-white/20"
            title="Exit Fullscreen"
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={image.url}
            alt={cleanTitle}
            className="animate-in zoom-in-95 max-h-[95vh] max-w-[95vw] rounded object-contain shadow-2xl duration-200"
          />
        </div>
      )}
    </div>,
    document.body
  );
}
