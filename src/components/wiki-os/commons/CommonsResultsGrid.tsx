"use client";

import { useState, useMemo, memo } from "react";
import { Skeleton } from "~/components/ui/skeleton";
import { ZoomIn, MediaImage as ImageIcon, RefreshDouble } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { BlurHashService } from "~/lib/wiki-os/core/blurhash-service";
import { PlaceholderImage } from "~/components/wiki-os/shared/PlaceholderImage";
import type { CommonsImage } from "~/components/wiki-os/media-search/types";

interface CommonsResultsGridProps {
  images: CommonsImage[];
  selectedImage: CommonsImage | null;
  onSelect: (image: CommonsImage) => void;
  /** Double-click on an image (the picker confirms its choice with it). */
  onConfirm?: (image: CommonsImage) => void;
  onLoadMore?: () => void;
  hasMore: boolean;
  isLoading: boolean;
  /** What the results are: nothing asked yet, a typed search, or a browsed category. */
  mode: "idle" | "search" | "browse";
  /** The search the results are for (shown when nothing was found). */
  query?: string;
  /** How many images were loaded before the type/orientation filters hid some. */
  loadedCount?: number;
  /** What an empty category or list says (the forum and own uploads are not categories). */
  emptyText?: string;
  totalHits?: number | null;
  error?: { rateLimited: boolean } | null;
  onRetry?: () => void;
  isFilterActive?: boolean;
  onClearFilters?: () => void;
}

const CommonsCard = memo(function CommonsCard({
  img,
  isSelected,
  onSelect,
  onConfirm,
}: {
  img: CommonsImage;
  isSelected: boolean;
  onSelect: (image: CommonsImage) => void;
  onConfirm?: (image: CommonsImage) => void;
}) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const cleanTitle = img.title.replace(/^File:/, "").replace(/_/g, " ");
  // A file with a BlurHash shows its blurred shape while loading, anything else a skeleton
  const placeholder = useMemo(
    () => BlurHashService.placeholderDataUri(img.blurhash, img.width, img.height),
    [img.blurhash, img.width, img.height]
  );

  return (
    <button
      type="button"
      onClick={() => onSelect(img)}
      onDoubleClick={onConfirm ? () => onConfirm(img) : undefined}
      aria-pressed={isSelected}
      aria-label={cleanTitle}
      className={cn(
        "wikios-commons-card group relative text-left select-none",
        "focus-visible:ring-tint focus-visible:ring-2 focus-visible:outline-none",
        "transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200 active:scale-[0.98]",
        isSelected && "wikios-commons-card--selected"
      )}
      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 200px" }}
    >
      <div className="wikios-commons-card-thumb bg-fill-4 relative aspect-[4/3] w-full overflow-hidden">
        {!imageLoaded && !imageError && !placeholder && (
          <Skeleton className="absolute inset-0 rounded-none" />
        )}

        {imageError ? (
          <div className="text-label-secondary absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center">
            <ImageIcon className="h-6 w-6 opacity-40" aria-hidden="true" />
            <span className="text-footnote opacity-70">
              {img.mime ? img.mime.split("/")[1] : "Image"}
            </span>
          </div>
        ) : (
          <PlaceholderImage
            placeholder={placeholder}
            src={img.thumbUrl}
            alt={cleanTitle}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            className={cn(
              "h-full w-full object-cover transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-300",
              imageLoaded || placeholder ? "opacity-100" : "opacity-0"
            )}
          />
        )}

        <div className="wikios-commons-card-overlay pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <div className="border-separator shadow-card rounded-full border bg-black/60 p-2 text-white">
            <ZoomIn className="h-4 w-4" aria-hidden="true" />
          </div>
        </div>
      </div>

      <div className="wikios-commons-card-info flex flex-col gap-0.5 p-3">
        <span className="wikios-commons-card-title text-caption text-label-secondary group-hover:text-label truncate transition-colors">
          {cleanTitle}
        </span>
        <div className="text-footnote text-label-secondary flex items-center justify-between">
          <span>{img.width > 0 && img.height > 0 ? `${img.width}×${img.height}` : "Vector"}</span>
          {img.license && <span className="max-w-[80px] truncate opacity-70">{img.license}</span>}
        </div>
      </div>
    </button>
  );
});

function ShimmerSkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="wikios-commons-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={`skeleton-${i}`}
          className="wikios-commons-card border-separator bg-surface overflow-hidden border"
        >
          <Skeleton className="aspect-[4/3] w-full rounded-none" />
          <div className="space-y-2 p-3">
            <Skeleton className="rounded-control-sm h-3 w-3/4" />
            <Skeleton className="rounded-control-sm h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function StateMessage({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="wikios-commons-empty flex flex-col items-center justify-center p-12 text-center">
      <div className="bg-fill-4 text-label-secondary mb-3 rounded-full p-3">
        <ImageIcon className="h-6 w-6" aria-hidden="true" />
      </div>
      <p className="text-body text-label mb-1 font-medium">{title}</p>
      <p className="text-footnote text-label-secondary mb-4 max-w-sm">{children}</p>
      {action}
    </div>
  );
}

function RetryButton({ onRetry }: { onRetry?: () => void }) {
  if (!onRetry) return null;
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onRetry}
      className="text-footnote border-separator hover:bg-fill-4"
    >
      <RefreshDouble className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
      Retry
    </Button>
  );
}

function errorMessage(error: { rateLimited: boolean }): string {
  return error.rateLimited
    ? "Too many searches. Wait a minute and retry."
    : "Could not reach the image source.";
}

function LoadMore({ onLoadMore }: { onLoadMore?: () => void }) {
  return (
    <div className="wikios-commons-loadmore pt-6 pb-2 text-center">
      <Button
        variant="outline"
        size="sm"
        onClick={onLoadMore}
        className="border-separator text-footnote hover:bg-fill-4 transition-[color,background-color,border-color,box-shadow,opacity,transform]"
      >
        Load more images
      </Button>
    </div>
  );
}

/** What to show when there are no images to list: not asked yet, filtered out, or nothing found. */
function EmptyState({
  mode,
  query,
  isFilterActive,
  onClearFilters,
  hasMore,
  onLoadMore,
  emptyText,
}: Pick<
  CommonsResultsGridProps,
  "mode" | "query" | "isFilterActive" | "onClearFilters" | "hasMore" | "onLoadMore" | "emptyText"
>) {
  if (isFilterActive) {
    return (
      <>
        <StateMessage
          title="No matching images found"
          action={
            onClearFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={onClearFilters}
                className="text-footnote border-separator hover:bg-fill-4"
              >
                <RefreshDouble className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                Reset filters
              </Button>
            )
          }
        >
          No images match your active type or orientation filters. Try resetting filters to see all
          results.
        </StateMessage>
        {hasMore && <LoadMore onLoadMore={onLoadMore} />}
      </>
    );
  }
  if (mode === "idle") {
    return (
      <StateMessage title="Explore images">
        Search for images using the search bar above, or browse a category.
      </StateMessage>
    );
  }
  if (mode === "search" && query) {
    return (
      <StateMessage title={`No images found for \u201c${query}\u201d`}>
        Try different words, or remove a category filter.
      </StateMessage>
    );
  }
  return (
    <StateMessage title="No images found">
      {emptyText ?? "This category has no images."}
    </StateMessage>
  );
}

function CountLine({
  shown,
  totalHits,
  loadedCount,
}: {
  shown: number;
  totalHits?: number | null;
  loadedCount?: number;
}) {
  const hidden = loadedCount !== undefined ? Math.max(0, loadedCount - shown) : 0;
  let text: string | null = null;
  if (totalHits != null && totalHits > 0) {
    text = `Showing ${shown} of ${totalHits.toLocaleString()}`;
  }
  if (!text) return null;
  return (
    <div className="text-footnote text-label-secondary mb-3 px-1">
      {text}
      {hidden > 0 && ` (${hidden} hidden by filters)`}
    </div>
  );
}

export function CommonsResultsGrid({
  images,
  selectedImage,
  onSelect,
  onConfirm,
  onLoadMore,
  hasMore,
  isLoading,
  mode,
  query,
  loadedCount,
  emptyText,
  totalHits,
  error,
  onRetry,
  isFilterActive,
  onClearFilters,
}: CommonsResultsGridProps) {
  if (images.length === 0) {
    if (isLoading) {
      return (
        <div className="wikios-commons-results">
          <ShimmerSkeletonGrid count={8} />
        </div>
      );
    }
    if (error) {
      return (
        <StateMessage title="Search failed" action={<RetryButton onRetry={onRetry} />}>
          {errorMessage(error)}
        </StateMessage>
      );
    }
    return (
      <EmptyState
        mode={mode}
        query={query}
        isFilterActive={isFilterActive}
        onClearFilters={onClearFilters}
        hasMore={hasMore}
        onLoadMore={onLoadMore}
        emptyText={emptyText}
      />
    );
  }

  return (
    <div className="wikios-commons-results">
      <CountLine shown={images.length} totalHits={totalHits} loadedCount={loadedCount} />

      <div className="wikios-commons-grid">
        {images.map((img) => (
          <CommonsCard
            key={img.url}
            img={img}
            isSelected={selectedImage?.url === img.url}
            onSelect={onSelect}
            onConfirm={onConfirm}
          />
        ))}
      </div>

      {isLoading && (
        <div className="mt-4">
          <ShimmerSkeletonGrid count={4} />
        </div>
      )}

      {error && (
        <div className="text-footnote text-label-secondary mt-4 flex items-center justify-center gap-3">
          <span role="alert">{errorMessage(error)}</span>
          <RetryButton onRetry={onRetry} />
        </div>
      )}

      {hasMore && !isLoading && <LoadMore onLoadMore={onLoadMore} />}
    </div>
  );
}
