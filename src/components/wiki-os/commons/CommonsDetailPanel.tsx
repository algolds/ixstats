"use client";

import { useState, useEffect, useCallback, useSyncExternalStore } from "react";
import {
  Xmark as X,
  Copy,
  Check,
  OpenNewWindow as ExternalLink,
  Download,
  Bookmark,
  MediaImage as Image,
  ZoomIn,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Eyebrow } from "~/components/ui/eyebrow";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Sheet, SheetContent, SheetTitle } from "~/components/ui/sheet";
import { WikiZoomDialog } from "~/components/wiki-os/shared/WikiZoomDialog";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { isMediaWikiUrl } from "~/lib/wiki-os/config";

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

const REGULAR_WIDTH_QUERY = "(min-width: 1024px)";
const subscribeToRegularWidth = (onChange: () => void) => {
  const query = window.matchMedia(REGULAR_WIDTH_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const getIsRegularWidth = () => window.matchMedia(REGULAR_WIDTH_QUERY).matches;

export function CommonsDetailPanel({ image, onClose }: CommonsDetailPanelProps) {
  const [copied, setCopied] = useState(false);
  const [copyImageSuccess, setCopyImageSuccess] = useState(false);
  const [format, setFormat] = useState<"thumb" | "embed" | "raw" | "url">("thumb");
  const [isZoomed, setIsZoomed] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const { user } = useUser();
  const isAuthenticated = !!user;

  // Below `lg` the detail view is a Sheet; at regular width it is the inline rail.
  const isRegular = useSyncExternalStore(subscribeToRegularWidth, getIsRegularWidth, () => true);
  const isCompact = !isRegular;

  // Escape closes the inline rail (the Sheet and zoom dialog handle their own Escape).
  useEffect(() => {
    if (!isRegular || isZoomed) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRegular, isZoomed, onClose]);

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
    const isLocal = isMediaWikiUrl(image.descriptionUrl);
    const isIiwiki = image.descriptionUrl.includes("iiwiki.com");
    let title = `commons:${image.title}`;
    if (isLocal) {
      title = image.title;
    } else if (isIiwiki) {
      title = `iiwiki:${image.title}`;
    }
    stashMutation.mutate({ pageTitle: title });
  }, [image.descriptionUrl, image.title, stashMutation]);

  const viewSourceLabel = isMediaWikiUrl(image.descriptionUrl)
    ? "View on IxWiki"
    : image.descriptionUrl.includes("iiwiki.com")
      ? "View on IIWiki"
      : "View on Commons";

  const panelContent = (
    <div className="flex h-full flex-col">
      {/* Sticky header and preview */}
      <div className="z-raised border-separator bg-surface sticky top-0 border-b">
        <div className="flex items-center justify-between gap-2 p-3">
          <h3 className="text-headline text-label truncate">{cleanTitle}</h3>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            title="Close Panel (Esc)"
            aria-label="Close Panel"
            className="text-label-secondary shrink-0 rounded-full"
          >
            <X aria-hidden="true" />
          </Button>
        </div>

        <button
          type="button"
          aria-label="Zoom image"
          className="group bg-surface-secondary relative block aspect-[4/3] w-full cursor-zoom-in overflow-hidden"
          onClick={() => setIsZoomed(true)}
        >
          {previewError ? (
            <span className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center">
              <Image className="text-label-secondary size-8" aria-hidden="true" />
              <span className="text-caption text-label-secondary">Preview Unavailable</span>
              <span className="text-footnote text-label-secondary">
                Click download to view original source
              </span>
            </span>
          ) : (
            <img
              src={image.url}
              alt={cleanTitle}
              loading="lazy"
              onError={() => setPreviewError(true)}
              className="ease-out-facet h-full w-full object-contain transition-transform duration-300 motion-reduce:transition-none"
              onContextMenu={(e) => e.preventDefault()}
            />
          )}
          <span className="duration-fast pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <span className="bg-surface-elevated text-caption text-label shadow-floating flex items-center gap-2 rounded-full px-3 py-2">
              <ZoomIn className="size-3.5" aria-hidden="true" />
              Click to Zoom
            </span>
          </span>
        </button>
      </div>

      {/* Actions and format selector */}
      <div className="border-separator space-y-3 border-b p-3">
        <div className="space-y-2">
          <Eyebrow>Wikitext Copy Format</Eyebrow>
          <SegmentedControl
            aria-label="Wikitext copy format"
            size="sm"
            fullWidth
            value={format}
            onValueChange={setFormat}
            options={[
              { value: "thumb", label: "Thumb" },
              { value: "embed", label: "Embed" },
              { value: "raw", label: "File" },
              { value: "url", label: "URL" },
            ]}
          />
        </div>

        <div className="flex gap-2">
          <Button size="sm" variant="bordered" onClick={handleCopy} className="flex-1">
            {copied ? (
              <Check className="text-green" aria-hidden="true" />
            ) : (
              <Copy aria-hidden="true" />
            )}
            {copied ? "Copied" : format === "url" ? "Copy URL" : "Copy Wikitext"}
          </Button>
          <Button
            size="icon-sm"
            variant="bordered"
            onClick={handleCopyImage}
            title="Copy image to clipboard"
            aria-label="Copy image to clipboard"
          >
            {copyImageSuccess ? (
              <Check className="text-green" aria-hidden="true" />
            ) : (
              <Image aria-hidden="true" />
            )}
          </Button>
          <Button
            size="icon-sm"
            variant="bordered"
            onClick={() => window.open(image.url, "_blank")}
            title="Download original file"
            aria-label="Download original file"
          >
            <Download aria-hidden="true" />
          </Button>
          {isAuthenticated && (
            <Button
              size="icon-sm"
              variant={stashMutation.isSuccess ? "tinted" : "bordered"}
              onClick={handleStash}
              disabled={stashMutation.isPending || stashMutation.isSuccess}
              title="Stash to library"
              aria-label="Stash to library"
            >
              <Bookmark aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        <dl className="divide-separator text-footnote divide-y">
          <div className="flex items-center justify-between gap-3 py-2">
            <dt className="text-label-secondary">Dimensions</dt>
            <dd className="text-label font-medium tabular-nums">
              {image.width} × {image.height}
            </dd>
          </div>
          {image.mime && (
            <div className="flex items-center justify-between gap-3 py-2">
              <dt className="text-label-secondary">Type</dt>
              <dd className="text-label font-medium">{image.mime}</dd>
            </div>
          )}
          {image.artist && (
            <div className="flex items-center justify-between gap-3 py-2">
              <dt className="text-label-secondary">Artist</dt>
              <dd className="text-label max-w-[160px] truncate font-medium">{image.artist}</dd>
            </div>
          )}
          {image.license && (
            <div className="flex items-center justify-between gap-3 py-2">
              <dt className="text-label-secondary">License</dt>
              <dd className="text-label font-medium">{image.license}</dd>
            </div>
          )}
        </dl>
        {image.description && (
          <div className="space-y-1">
            <Eyebrow>Description</Eyebrow>
            <p className="text-footnote text-label-secondary leading-relaxed">
              {image.description.slice(0, 300)}
              {image.description.length > 300 ? "..." : ""}
            </p>
          </div>
        )}
        <Button asChild size="sm" variant="gray">
          <a href={image.descriptionUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink aria-hidden="true" />
            {viewSourceLabel}
          </a>
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Regular width: inline rail */}
      <div className="wikios-commons-detail bg-surface relative hidden overflow-hidden lg:flex">
        {panelContent}
      </div>

      {/* Compact width: detail sheet (spec §7.3) */}
      <Sheet open={isCompact} onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          showCloseButton={false}
          className="p-0 sm:max-w-sm"
          aria-describedby={undefined}
        >
          <SheetTitle className="sr-only">{cleanTitle}</SheetTitle>
          {panelContent}
        </SheetContent>
      </Sheet>

      <WikiZoomDialog
        open={isZoomed}
        onOpenChange={setIsZoomed}
        src={image.url}
        alt={cleanTitle}
        caption={cleanTitle}
        meta={`${image.width} × ${image.height} • ${image.mime}`}
      />
    </>
  );
}
