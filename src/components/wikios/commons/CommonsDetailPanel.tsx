"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Copy, Check, ExternalLink, Download, Bookmark, Image } from "lucide-react";
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
  const { user } = useUser();
  const isAuthenticated = !!user;

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

  const cleanTitle = image.title.replace(/^File:/, "").replace(/_/g, " ");

  const stashMutation = api.wikios.stashPage.useMutation();

  const handleCopy = () => {
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
  };

  const handleCopyImage = async () => {
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
  };

  const handleStash = () => {
    const isLocal = image.descriptionUrl.includes("ixwiki.com");
    const isIiwiki = image.descriptionUrl.includes("iiwiki.com");
    let title = `commons:${image.title}`;
    if (isLocal) {
      title = image.title;
    } else if (isIiwiki) {
      title = `iiwiki:${image.title}`;
    }
    stashMutation.mutate({ pageTitle: title });
  };

  return (
    <div className="wikios-commons-detail relative overflow-hidden">
      <TextureOverlay texture="paperGrain" opacity={0.06} className="mix-blend-overlay" />
      <TextureOverlay texture="diagonal" opacity={0.03} className="mix-blend-overlay" />
      {/* Sticky Header and Preview Container */}
      <div className="sticky top-0 z-10 bg-[var(--wikios-surface)] border-b border-[var(--wikios-border)] shadow-sm">
        {/* Header */}
        <div className="wikios-commons-detail-header !border-b-0">
          <h3 className="wikios-commons-detail-title">{cleanTitle}</h3>
          <button onClick={onClose} className="wikios-commons-detail-close group">
            <X className="h-4 w-4 transition-colors duration-200 group-hover:text-red-500" />
          </button>
        </div>

        {/* Preview */}
        <div
          className="wikios-commons-detail-preview group relative cursor-zoom-in overflow-hidden"
          onClick={() => setIsZoomed(true)}
        >
          <img
            src={image.url}
            alt={cleanTitle}
            loading="lazy"
            className="transition-transform duration-300 group-hover:scale-[1.02]"
            onContextMenu={(e) => e.preventDefault()}
          />
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
      <div className="border-b border-[var(--wikios-border)] pb-3">
        {/* Format Selector */}
        <div className="px-3 pt-3 pb-2">
          <span className="mb-1.5 block text-[9px] font-bold tracking-wider text-[var(--wikios-text-dim)] uppercase">
            Wikitext Copy Format
          </span>
          <div className="wikios-filter-group grid grid-cols-4">
            {(["thumb", "embed", "raw", "url"] as const).map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => setFormat(fmt)}
                className={cn("wikios-filter-btn", format === fmt && "wikios-filter-btn--active")}
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
          <Button size="sm" variant="outline" onClick={handleCopy} className="flex-1 text-xs group">
            {copied ? (
              <Check className="mr-1.5 h-3.5 w-3.5 text-green-400" />
            ) : (
              <Copy className="mr-1.5 h-3.5 w-3.5 transition-colors duration-200 group-hover:text-blue-500" />
            )}
            {copied ? "Copied" : format === "url" ? "Copy URL" : "Copy Wikitext"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopyImage}
            title="Copy image to clipboard"
            className="text-[var(--wikios-text-dim)] hover:text-[var(--wikios-text)] group"
          >
            {copyImageSuccess ? (
              <Check className="h-3.5 w-3.5 text-green-400" />
            ) : (
              <Image className="h-3.5 w-3.5 transition-colors duration-200 group-hover:text-cyan-500" />
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.open(image.url, "_blank")}
            title="Download original file"
            className="text-[var(--wikios-text-dim)] hover:text-[var(--wikios-text)] group"
          >
            <Download className="h-3.5 w-3.5 transition-colors duration-200 group-hover:text-amber-500" />
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
                  ? "border-green-500/30 bg-green-500/20 text-green-400"
                  : "text-[var(--wikios-text-dim)] hover:text-[var(--wikios-text)]",
                "group"
              )}
            >
              <Bookmark className={cn(
                "h-3.5 w-3.5 transition-colors duration-200",
                stashMutation.isSuccess ? "text-green-400" : "group-hover:text-emerald-500"
              )} />
            </Button>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="wikios-commons-detail-meta">
        <div className="wikios-commons-detail-row">
          <span className="wikios-commons-detail-label">Dimensions</span>
          <span>
            {image.width} × {image.height}
          </span>
        </div>
        {image.mime && (
          <div className="wikios-commons-detail-row">
            <span className="wikios-commons-detail-label">Type</span>
            <span>{image.mime}</span>
          </div>
        )}
        {image.artist && (
          <div className="wikios-commons-detail-row">
            <span className="wikios-commons-detail-label">Artist</span>
            <span>{image.artist}</span>
          </div>
        )}
        {image.license && (
          <div className="wikios-commons-detail-row">
            <span className="wikios-commons-detail-label">License</span>
            <span>{image.license}</span>
          </div>
        )}
        {image.description ? (
          <div className="wikios-commons-detail-desc">
            <span className="wikios-commons-detail-label">Description</span>
            <p className="mb-2.5">
              {image.description.slice(0, 300)}
              {image.description.length > 300 ? "..." : ""}
            </p>
            <div className="mt-2">
              <a
                href={image.descriptionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-blue-500/25 bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-blue-400 hover:bg-blue-500/20 transition-all select-none"
              >
                <ExternalLink className="h-3 w-3" />
                {image.descriptionUrl.includes("ixwiki.com")
                  ? "View details on IxWiki"
                  : image.descriptionUrl.includes("iiwiki.com")
                    ? "View details on IIWiki"
                    : "View details on Commons"}
              </a>
            </div>
          </div>
        ) : (
          <div className="mt-3 pt-2 border-t border-white/5">
            <a
              href={image.descriptionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-blue-500/25 bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-blue-400 hover:bg-blue-500/20 transition-all select-none"
            >
              <ExternalLink className="h-3 w-3" />
              {image.descriptionUrl.includes("ixwiki.com")
                ? "View details on IxWiki"
                : image.descriptionUrl.includes("iiwiki.com")
                  ? "View details on IIWiki"
                  : "View details on Commons"}
            </a>
          </div>
        )}
      </div>

      {/* Lightbox Zoom Modal */}
      {isZoomed &&
        createPortal(
          <div
            className="animate-in fade-in fixed inset-0 z-[120002] flex items-center justify-center bg-black/90 backdrop-blur-md duration-200"
            onClick={() => setIsZoomed(false)}
          >
            <button
              onClick={() => setIsZoomed(false)}
              className="absolute top-4 right-4 cursor-pointer rounded-full border border-white/10 bg-white/10 p-2.5 text-white transition-all hover:bg-white/20"
              title="Close Lightbox"
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
    </div>
  );
}
