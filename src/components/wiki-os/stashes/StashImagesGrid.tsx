"use client";
// src/components/wiki-os/stashes/StashImagesGrid.tsx
// Saved Wikimedia Commons media grid with interactive lightbox modal.

import { useState, useMemo } from "react";
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
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Eyebrow } from "~/components/ui/eyebrow";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Sheet, SheetContent, SheetTitle } from "~/components/ui/sheet";
import { WikiZoomDialog } from "~/components/wiki-os/shared/WikiZoomDialog";
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
          const cleanTitle = item.pageTitle.replace(/^commons:File:/, "").replace(/_/g, " ");

          return (
            <div
              key={item.id}
              className="group rounded-card border-separator bg-surface duration-fast hover:shadow-card relative flex cursor-pointer flex-col overflow-hidden border transition-shadow"
              onClick={() => imgInfo && setSelectedImage(imgInfo)}
            >
              <div className="border-separator bg-fill-4 relative aspect-4/3 w-full overflow-hidden border-b">
                {imgInfo ? (
                  <img
                    src={imgInfo.thumbUrl}
                    alt={cleanTitle}
                    className="h-full w-full object-cover transition-transform duration-300"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin opacity-40" />
                  </div>
                )}

                {/* Hover overlay button */}
                <div className="duration-fast absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="bg-surface-elevated text-label shadow-floating flex size-8 items-center justify-center rounded-full">
                    <ZoomIn className="size-4" aria-hidden="true" />
                  </div>
                </div>

                {/* Remove button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUnstash(item.pageTitle);
                  }}
                  className="bg-surface-elevated text-label-secondary shadow-floating duration-fast hover:bg-red hover:text-on-red absolute top-2 right-2 flex size-7 items-center justify-center rounded-full opacity-0 transition-[color,background-color,opacity] group-hover:opacity-100 focus-visible:opacity-100"
                  title="Remove from stash"
                  aria-label="Remove from stash"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </div>

              <div className="flex flex-1 flex-col justify-between gap-1 p-2.5">
                <span
                  className="text-caption text-label group-hover:text-tint truncate font-semibold transition-colors"
                  title={cleanTitle}
                >
                  {cleanTitle}
                </span>
                <span className="text-footnote text-label-secondary tabular-nums">
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
          throw new Error("Failed to download image from server", { cause: directErr });
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

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        className="flex flex-col gap-4 overflow-y-auto sm:max-w-md"
        aria-describedby={undefined}
      >
        <div className="pr-8">
          <Eyebrow className="text-tint">Stashed Media</Eyebrow>
          <SheetTitle className="text-title-3 mt-0.5 break-words">{cleanTitle}</SheetTitle>
        </div>

        <button
          type="button"
          className="group rounded-row border-separator bg-surface-secondary relative flex min-h-[200px] cursor-zoom-in items-center justify-center overflow-hidden border"
          onClick={() => setIsZoomed(true)}
          title="Click to view fullscreen"
          aria-label="View fullscreen"
        >
          <img
            src={image.url}
            alt={cleanTitle}
            className="max-h-[50vh] max-w-full object-contain"
          />
          <span className="duration-fast absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
            <span className="bg-surface-elevated text-label shadow-floating duration-fast rounded-full p-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              <ZoomIn className="size-5" aria-hidden="true" />
            </span>
          </span>
        </button>

        <dl className="border-separator text-footnote grid grid-cols-2 gap-y-1 border-y py-3">
          <dt className="text-label-secondary">Dimensions:</dt>
          <dd className="text-label text-right tabular-nums">
            {image.width} × {image.height}
          </dd>
          <dt className="text-label-secondary">Type:</dt>
          <dd className="text-label text-right">
            {image.mime.split("/")[1]?.toUpperCase() ?? "Unknown"}
          </dd>
          {image.license && (
            <>
              <dt className="text-label-secondary">License:</dt>
              <dd className="text-label truncate text-right" title={image.license}>
                {image.license}
              </dd>
            </>
          )}
        </dl>

        <div className="space-y-1.5">
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

        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-3 gap-2">
            <Button onClick={handleCopy} className="col-span-2">
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              {copied ? "Copied" : format === "url" ? "Copy URL" : "Copy Wikitext"}
            </Button>
            <Button
              variant="bordered"
              onClick={handleCopyImage}
              disabled={isCopyingImage}
              title="Copy Image to Clipboard"
            >
              {isCopyingImage ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : copiedImage ? (
                <Check aria-hidden="true" />
              ) : (
                <ImageIcon aria-hidden="true" />
              )}
              {copiedImage ? "Copied" : "Image"}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="bordered" onClick={() => window.open(image.url, "_blank")}>
              <Download aria-hidden="true" /> Download
            </Button>
            <Button variant="destructive" onClick={onUnstash}>
              <Trash2 aria-hidden="true" /> Unstash
            </Button>
          </div>
        </div>
      </SheetContent>

      <WikiZoomDialog open={isZoomed} onOpenChange={setIsZoomed} src={image.url} alt={cleanTitle} />
    </Sheet>
  );
}
