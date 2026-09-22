"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Xmark as X,
  Copy,
  Check,
  OpenNewWindow as ExternalLink,
  Download,
  Bookmark,
  MediaImage as Image,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { useUser } from "~/context/auth-context";
import { cn } from "~/lib/utils";

interface CommonsImage {
  pageid: number;
  title: string;
  thumbUrl: string;
  url: string;
  descriptionUrl: string;
  width: number;
  height: number;
  mime: string;
  description: string;
  artist: string;
  license: string;
}

interface CommonsDetailPanelProps {
  image: CommonsImage;
  onClose: () => void;
}

export function CommonsDetailPanel({ image, onClose }: CommonsDetailPanelProps) {
  const [copied, setCopied] = useState(false);
  const [copyImageSuccess, setCopyImageSuccess] = useState(false);
  const [format, setFormat] = useState<"thumb" | "embed" | "raw" | "url">("thumb");
  const [isZoomed, setIsZoomed] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { user } = useUser();
  const isAuthenticated = !!user;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when zoomed
  useEffect(() => {
    if (isZoomed) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isZoomed]);

  // Global Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isZoomed) {
          setIsZoomed(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isZoomed, onClose]);

  const cleanTitle = image.title.replace(/^File:/, "").replace(/_/g, " ");

  const stashMutation = api.wikios.stashPage.useMutation();

  const handleCopy = useCallback(() => {
    let textToCopy = "";
    if (format === "thumb") {
      textToCopy = `[[${image.title}|thumb|${cleanTitle}]]`;
    } else if (format === "embed") {
      textToCopy = `[[${image.title}|250px]]`;
    } else if (format === "raw") {
      textToCopy = `[[${image.title}]]`;
    } else if (format === "url") {
      textToCopy = image.url;
    }
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [cleanTitle, format, image.title, image.url]);

  const handleCopyImage = useCallback(async () => {
    try {
      const response = await fetch(image.url);
      const blob = await response.blob();
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({
            [blob.type]: blob,
          }),
        ]);
        setCopyImageSuccess(true);
        setTimeout(() => setCopyImageSuccess(false), 2000);
      } else {
        await navigator.clipboard.writeText(image.url);
        setCopyImageSuccess(true);
        setTimeout(() => setCopyImageSuccess(false), 2000);
      }
    } catch (err) {
      console.warn("Failed to copy image blob, falling back to copying URL text:", err);
      try {
        await navigator.clipboard.writeText(image.url);
        setCopyImageSuccess(true);
        setTimeout(() => setCopyImageSuccess(false), 2000);
      } catch (e) {
        console.error(e);
      }
    }
  }, [image.url]);

  const handleStash = useCallback(() => {
    const isLocal = image.descriptionUrl.includes("ixwiki.com");
    const isIiwiki = image.descriptionUrl.includes("iiwiki.com");
    let title = `commons:${image.title}`;
    if (isLocal) {
      title = image.title;
    } else if (isIiwiki) {
      title = `iiwiki:${image.title}`;
    }
    stashMutation.mutate({ pageTitle: title });
  }, [image.descriptionUrl, image.title, stashMutation]);

  const panelContent = (
    <div className="flex h-full flex-col">
      <TextureOverlay texture="paperGrain" opacity={0.06} className="mix-blend-overlay" />
      <TextureOverlay texture="diagonal" opacity={0.03} className="mix-blend-overlay" />

      {/* Sticky Header and Preview Container */}
      <div className="sticky top-0 z-10 border-b border-border/40 bg-card shadow-xs">
        {/* Header */}
        <div className="flex items-center justify-between p-3">
          <h3 className="truncate pr-2 text-xs font-semibold text-foreground">
            {cleanTitle}
          </h3>
          <button
            onClick={onClose}
            className="group rounded-full p-1 text-muted-foreground hover:bg-muted/60 hover:text-foreground active:scale-95 transition-all cursor-pointer"
            title="Close Panel (Esc)"
            aria-label="Close Panel"
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Preview */}
        <div
          className="group relative aspect-[4/3] w-full cursor-zoom-in overflow-hidden bg-black/30"
          onClick={() => setIsZoomed(true)}
        >
          {previewError ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center text-muted-foreground/60">
              <Image className="h-8 w-8 opacity-40" />
              <span className="text-[11px] font-medium tracking-wide text-muted-foreground">
                Preview Unavailable
              </span>
              <span className="text-[9px] text-muted-foreground/70">
                Click download to view original source
              </span>
            </div>
          ) : (
            <img
              src={image.url}
              alt={cleanTitle}
              loading="lazy"
              onError={() => setPreviewError(true)}
              className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.02]"
              onContextMenu={(e) => e.preventDefault()}
            />
          )}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            <span className="flex items-center gap-1.5 rounded-md border border-white/10 bg-zinc-950/80 px-2.5 py-1.5 text-[10px] font-bold tracking-wider text-white uppercase shadow-lg backdrop-blur-md">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"
                />
              </svg>
              Click to Zoom
            </span>
          </div>
        </div>
      </div>

      {/* Actions and Format Selector */}
      <div className="border-b border-border/40 pb-3">
        {/* Format Selector */}
        <div className="px-3 pt-3 pb-2">
          <span className="mb-1.5 block text-[9px] font-semibold tracking-wider text-muted-foreground uppercase">
            Wikitext Copy Format
          </span>
          <div
            role="radiogroup"
            aria-label="Wikitext copy format"
            className="grid grid-cols-4 gap-0.5 p-0.5 rounded-lg bg-muted/60 border border-border/40 backdrop-blur-sm"
          >
            {(["thumb", "embed", "raw", "url"] as const).map((fmt) => (
              <button
                key={fmt}
                type="button"
                role="radio"
                aria-checked={format === fmt}
                onClick={() => setFormat(fmt)}
                className={cn(
                  "py-1 text-[10px] font-medium rounded-md transition-all duration-150 active:scale-[0.97] cursor-pointer text-center select-none",
                  format === fmt
                    ? "bg-background text-foreground font-semibold shadow-2xs border border-border/50"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
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

        {/* Action Buttons */}
        <div className="flex gap-1.5 px-3">
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopy}
            className="group flex-1 text-xs active:scale-95 transition-all cursor-pointer"
          >
            {copied ? (
              <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-400 animate-in zoom-in-50 duration-150" />
            ) : (
              <Copy className="mr-1.5 h-3.5 w-3.5 transition-colors duration-200 group-hover:text-primary" />
            )}
            {copied ? "Copied" : format === "url" ? "Copy URL" : "Copy Wikitext"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopyImage}
            title="Copy image to clipboard"
            className="group text-muted-foreground hover:text-foreground active:scale-95 transition-all cursor-pointer"
          >
            {copyImageSuccess ? (
              <Check className="h-3.5 w-3.5 text-emerald-400 animate-in zoom-in-50 duration-150" />
            ) : (
              <Image className="h-3.5 w-3.5 transition-colors duration-200 group-hover:text-primary" />
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.open(image.url, "_blank")}
            title="Download original file"
            className="group text-muted-foreground hover:text-foreground active:scale-95 transition-all cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 transition-colors duration-200 group-hover:text-primary" />
          </Button>
          {isAuthenticated && (
            <Button
              size="sm"
              variant={stashMutation.isSuccess ? "default" : "outline"}
              onClick={handleStash}
              disabled={stashMutation.isPending || stashMutation.isSuccess}
              title="Stash to library"
              className={cn(
                stashMutation.isSuccess
                  ? "border-emerald-500/30 bg-emerald-500/20 text-emerald-400"
                  : "text-muted-foreground hover:text-foreground",
                "group active:scale-95 transition-all cursor-pointer"
              )}
            >
              <Bookmark
                className={cn(
                  "h-3.5 w-3.5 transition-colors duration-200",
                  stashMutation.isSuccess ? "text-emerald-400" : "group-hover:text-primary"
                )}
              />
            </Button>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
        <div className="flex items-center justify-between py-1.5 text-[11px] border-b border-border/30">
          <span className="text-muted-foreground">Dimensions</span>
          <span className="text-foreground font-medium tabular-nums">
            {image.width} × {image.height}
          </span>
        </div>
        {image.mime && (
          <div className="flex items-center justify-between py-1.5 text-[11px] border-b border-border/30">
            <span className="text-muted-foreground">Type</span>
            <span className="text-foreground font-medium">{image.mime}</span>
          </div>
        )}
        {image.artist && (
          <div className="flex items-center justify-between py-1.5 text-[11px] border-b border-border/30">
            <span className="text-muted-foreground">Artist</span>
            <span className="max-w-[160px] truncate text-foreground font-medium">{image.artist}</span>
          </div>
        )}
        {image.license && (
          <div className="flex items-center justify-between py-1.5 text-[11px] border-b border-border/30">
            <span className="text-muted-foreground">License</span>
            <span className="text-foreground font-medium">{image.license}</span>
          </div>
        )}
        {image.description ? (
          <div className="pt-2">
            <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider block mb-1">
              Description
            </span>
            <p className="mb-2.5 text-xs leading-relaxed text-muted-foreground">
              {image.description.slice(0, 300)}
              {image.description.length > 300 ? "..." : ""}
            </p>
            <div className="mt-2">
              <a
                href={image.descriptionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/60 px-2.5 py-0.5 text-[10px] font-semibold text-foreground transition-all select-none hover:bg-muted active:scale-95"
              >
                <ExternalLink className="h-3 w-3" />
                {image.descriptionUrl.includes("ixwiki.com")
                  ? "View on IxWiki"
                  : image.descriptionUrl.includes("iiwiki.com")
                    ? "View on IIWiki"
                    : "View on Commons"}
              </a>
            </div>
          </div>
        ) : (
          <div className="mt-3 border-t border-border/30 pt-2">
            <a
              href={image.descriptionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/60 px-2.5 py-0.5 text-[10px] font-semibold text-foreground transition-all select-none hover:bg-muted active:scale-95"
            >
              <ExternalLink className="h-3 w-3" />
              {image.descriptionUrl.includes("ixwiki.com")
                ? "View on IxWiki"
                : image.descriptionUrl.includes("iiwiki.com")
                  ? "View on IIWiki"
                  : "View on Commons"}
              </a>
            </div>
          )}
        </div>
      </div>
  );

  return (
    <>
      {/* Desktop Inline Rail */}
      <div className="wikios-commons-detail relative hidden lg:flex overflow-hidden">
        {panelContent}
      </div>

      {/* Mobile/Tablet Slide-over Sheet Drawer */}
      {mounted &&
        createPortal(
          <div className="lg:hidden fixed inset-0 z-[1000] flex justify-end">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
              onClick={onClose}
            />

            {/* Slide-over Drawer */}
            <div className="relative z-10 h-full w-full max-w-sm bg-[var(--wikios-surface)] border-l border-[var(--wikios-border)] shadow-2xl animate-in slide-in-from-right duration-250 flex flex-col">
              {panelContent}
            </div>
          </div>,
          document.body
        )}

      {/* Lightbox Zoom Modal */}
      {isZoomed &&
        createPortal(
          <div
            className="animate-in fade-in fixed inset-0 z-[120002] flex items-center justify-center bg-black/90 backdrop-blur-md duration-200"
            onClick={() => setIsZoomed(false)}
          >
            <button
              onClick={() => setIsZoomed(false)}
              className="absolute top-4 right-4 cursor-pointer rounded-full border border-white/10 bg-white/10 p-2.5 text-white transition-all hover:bg-white/20 active:scale-95"
              title="Close Lightbox (Esc)"
              type="button"
            >
              <X className="h-5 w-5" />
            </button>

            <div
              className="relative flex max-h-[90vh] max-w-[90vw] flex-col items-center justify-center p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={image.url}
                alt={cleanTitle}
                className="animate-in zoom-in-95 max-h-[80vh] max-w-full rounded-md border border-white/10 object-contain shadow-2xl duration-200"
                onContextMenu={(e) => e.preventDefault()}
              />
              <div className="mt-4 rounded-full border border-white/5 bg-black/60 px-4 py-2 text-center backdrop-blur-md select-none">
                <p className="max-w-[80vw] truncate text-sm font-semibold text-white/90">
                  {cleanTitle}
                </p>
                <p className="text-xs text-white/50">
                  {image.width} × {image.height} • {image.mime}
                </p>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
