"use client";

import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from "react";
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
import { Sheet, SheetContent, SheetTitle } from "~/components/ui/sheet";
import { WikiZoomDialog } from "~/components/wiki-os/shared/WikiZoomDialog";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { useNotify } from "~/hooks/useNotify";
import { isMediaWikiUrl } from "~/lib/wiki-os/config";
import {
  CopyFormatSelector,
  copyFormatText,
  type CopyFormat,
} from "~/components/wiki-os/media-search/CopyFormatSelector";
import type { CommonsImage } from "~/components/wiki-os/media-search/types";
import { attributionLine } from "~/components/wiki-os/editor/ImageSearchGrid";

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

const COMMONS_THUMB_URL =
  /^https:\/\/(?:upload|thumb)\.wikimedia\.org\/.+\/thumb\/.+\/\d+px-[^/?]+(?:\?.*)?$/;

/** A sized image for the preview: Commons thumbs are re-requested at 960px, anything else is used as given. */
export function previewSrc(image: Pick<CommonsImage, "thumbUrl" | "url">): string {
  const thumb = image.thumbUrl;
  if (thumb && COMMONS_THUMB_URL.test(thumb)) {
    // Only the width segment changes; the utm_* tracking query Commons appends is dropped.
    return thumb.replace(/\?.*$/, "").replace(/\/\d+px-([^/]+)$/, "/960px-$1");
  }
  return thumb || image.url;
}

type CopyImageState = "idle" | "image" | "link";
type PreviewStage = "sized" | "original" | "failed";

const FEEDBACK_MS = 2000;

/** Each image gets its own panel instance, so copy, preview and stash state never leak between images. */
export function CommonsDetailPanel(props: CommonsDetailPanelProps) {
  return <DetailPanelBody key={props.image.url} {...props} />;
}

function DetailPanelBody({ image, onClose }: CommonsDetailPanelProps) {
  const notify = useNotify();
  const [copied, setCopied] = useState(false);
  const [attributionCopied, setAttributionCopied] = useState(false);
  const [copyImageState, setCopyImageState] = useState<CopyImageState>("idle");
  const [format, setFormat] = useState<CopyFormat>("thumb");
  const [isZoomed, setIsZoomed] = useState(false);
  const [previewStage, setPreviewStage] = useState<PreviewStage>("sized");
  const rootRef = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const { user } = useUser();
  const isAuthenticated = !!user;

  // Below `lg` the detail view is a Sheet; at regular width it is the inline rail.
  const isRegular = useSyncExternalStore(subscribeToRegularWidth, getIsRegularWidth, () => true);
  const isCompact = !isRegular;

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const flash = useCallback((reset: () => void) => {
    timers.current.push(setTimeout(reset, FEEDBACK_MS));
  }, []);

  // Escape closes the inline rail (the Sheet and zoom dialog handle their own Escape).
  // Inside a dialog (the image picker) the dialog owner handles Escape instead.
  useEffect(() => {
    if (!isRegular || isZoomed) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (rootRef.current?.closest('[role="dialog"]')) return;
      onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRegular, isZoomed, onClose]);

  // Rail mode: move focus to the close button, and hand it back on unmount.
  useEffect(() => {
    const root = rootRef.current;
    if (!isRegular || !root) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    root.querySelector<HTMLElement>('button[aria-label="Close panel"]')?.focus();
    return () => {
      const active = document.activeElement;
      const focusIsLost = !active || active === document.body || root.contains(active);
      if (focusIsLost && previous && document.contains(previous)) previous.focus();
    };
  }, [isRegular]);

  const cleanTitle = image.title.replace(/^File:/, "").replace(/_/g, " ");
  const hasDimensions = image.width > 0 && image.height > 0;

  const stashMutation = api.wikios.stashPage.useMutation();

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(copyFormatText(format, image));
    } catch {
      notify.error("Could not copy", "Your browser blocked clipboard access.");
      return;
    }
    setCopied(true);
    flash(() => setCopied(false));
  }, [flash, format, image, notify]);

  const credit = attributionLine(image);
  const handleCopyAttribution = useCallback(async () => {
    if (!credit) return;
    const source = image.descriptionUrl ? ` Source: ${image.descriptionUrl}` : "";
    try {
      await navigator.clipboard.writeText(`${cleanTitle} (${credit}).${source}`);
    } catch {
      notify.error("Could not copy", "Your browser blocked clipboard access.");
      return;
    }
    setAttributionCopied(true);
    flash(() => setAttributionCopied(false));
  }, [cleanTitle, credit, flash, image.descriptionUrl, notify]);

  const handleCopyImage = useCallback(async () => {
    try {
      const response = await fetch(previewSrc(image));
      const blob = await response.blob();
      if (blob.type === "image/png" && typeof window.ClipboardItem !== "undefined") {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        setCopyImageState("image");
        flash(() => setCopyImageState("idle"));
        return;
      }
    } catch {
      // Fall through to copying the link.
    }
    try {
      await navigator.clipboard.writeText(image.url);
      setCopyImageState("link");
      flash(() => setCopyImageState("idle"));
    } catch {
      notify.error("Could not copy", "Your browser blocked clipboard access.");
    }
  }, [flash, image, notify]);

  const handleStash = useCallback(() => {
    const isLocal = isMediaWikiUrl(image.descriptionUrl);
    const isIiwiki = image.descriptionUrl.includes("iiwiki.com");
    let title = `commons:${image.title}`;
    if (isLocal) {
      title = image.title;
    } else if (isIiwiki) {
      title = `iiwiki:${image.title}`;
    }
    stashMutation.mutate(
      { pageTitle: title },
      {
        onSuccess: () => notify.success("Added to your stash"),
        onError: () => notify.error("Could not stash this image", "Please try again."),
      }
    );
  }, [image.descriptionUrl, image.title, notify, stashMutation]);

  const copyImageLabel =
    copyImageState === "image"
      ? "Image copied"
      : copyImageState === "link"
        ? "Link copied"
        : "Copy image to clipboard";

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
            aria-label="Close panel"
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
          {previewStage === "failed" ? (
            <span className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center">
              <Image className="text-label-secondary size-8" aria-hidden="true" />
              <span className="text-caption text-label-secondary">Preview unavailable</span>
              <span className="text-footnote text-label-secondary">
                Click download to view original source
              </span>
            </span>
          ) : (
            <img
              src={previewStage === "sized" ? previewSrc(image) : image.url}
              alt={cleanTitle}
              loading="lazy"
              onError={() =>
                setPreviewStage(
                  previewStage === "sized" && previewSrc(image) !== image.url
                    ? "original"
                    : "failed"
                )
              }
              className="ease-out-facet h-full w-full object-contain transition-transform duration-300 motion-reduce:transition-none"
            />
          )}
          <span className="duration-fast pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <span className="bg-surface-elevated text-caption text-label shadow-floating flex items-center gap-2 rounded-full px-3 py-2">
              <ZoomIn className="size-3.5" aria-hidden="true" />
              Click to zoom
            </span>
          </span>
        </button>
      </div>

      {/* Actions and format selector */}
      <div className="border-separator space-y-3 border-b p-3">
        <span role="status" className="sr-only">
          {copied || attributionCopied ? "Copied" : copyImageState === "idle" ? "" : copyImageLabel}
        </span>
        <CopyFormatSelector value={format} onValueChange={setFormat} />

        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void handleCopy()} className="flex-1">
            {copied ? (
              <Check className="text-green" aria-hidden="true" />
            ) : (
              <Copy aria-hidden="true" />
            )}
            {copied ? "Copied" : format === "url" ? "Copy URL" : "Copy wikitext"}
          </Button>
          <Button
            size="icon-sm"
            variant="outline"
            onClick={() => void handleCopyImage()}
            title={copyImageLabel}
            aria-label={copyImageLabel}
          >
            {copyImageState === "idle" ? (
              <Image aria-hidden="true" />
            ) : (
              <Check className="text-green" aria-hidden="true" />
            )}
          </Button>
          <Button asChild size="icon-sm" variant="outline">
            <a
              href={image.url}
              target="_blank"
              rel="noopener noreferrer"
              download
              title="Download original file"
              aria-label="Download original file"
            >
              <Download aria-hidden="true" />
            </a>
          </Button>
          {isAuthenticated && (
            <Button
              size="icon-sm"
              variant={stashMutation.isSuccess ? "secondary" : "outline"}
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
          {hasDimensions && (
            <div className="flex items-center justify-between gap-3 py-2">
              <dt className="text-label-secondary">Dimensions</dt>
              <dd className="text-label font-medium tabular-nums">
                {image.width} × {image.height}
              </dd>
            </div>
          )}
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
        {credit && (
          <Button size="sm" variant="outline" onClick={() => void handleCopyAttribution()}>
            {attributionCopied ? (
              <Check className="text-green" aria-hidden="true" />
            ) : (
              <Copy aria-hidden="true" />
            )}
            {attributionCopied ? "Copied" : "Copy attribution"}
          </Button>
        )}
        {image.description && (
          <div className="space-y-1">
            <Eyebrow>Description</Eyebrow>
            <p className="text-footnote text-label-secondary leading-relaxed">
              {image.description.slice(0, 300)}
              {image.description.length > 300 ? "..." : ""}
            </p>
          </div>
        )}
        <Button asChild size="sm" variant="secondary">
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
      <div
        ref={rootRef}
        className="wikios-commons-detail bg-surface relative hidden overflow-hidden lg:flex"
      >
        {panelContent}
      </div>

      {/* Compact width: detail sheet */}
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
        meta={[hasDimensions ? `${image.width} × ${image.height}` : "", image.mime]
          .filter(Boolean)
          .join(" • ")}
      />
    </>
  );
}
