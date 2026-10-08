"use client";

import { useState, useCallback, memo } from "react";
import { Skeleton } from "~/components/ui/skeleton";
import { ZoomIn, MediaImage as ImageIcon, RefreshDouble } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import type { CommonsImage } from "~/components/wiki-os/media-search/types";

interface CommonsResultsGridProps {
  images: CommonsImage[];
  selectedImage: CommonsImage | null;
  onSelect: (image: CommonsImage) => void;
  onLoadMore?: () => void;
  hasMore: boolean;
  isLoading: boolean;
  totalHits?: number | null;
  isFilterActive?: boolean;
  onClearFilters?: () => void;
}

const CommonsCard = memo(function CommonsCard({
  img,
  isSelected,
  onSelect,
}: {
  img: CommonsImage;
  isSelected: boolean;
  onSelect: (image: CommonsImage) => void;
}) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const cleanTitle = img.title.replace(/^File:/, "").replace(/_/g, " ");

  const handleClick = useCallback(() => {
    onSelect(img);
  }, [img, onSelect]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect(img);
      }
    },
    [img, onSelect]
  );

  return (
    <button
      type="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-selected={isSelected}
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
        {!imageLoaded && !imageError && <Skeleton className="absolute inset-0 rounded-none" />}

        {imageError ? (
          <div className="text-label-secondary absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center">
            <ImageIcon className="h-6 w-6 opacity-40" />
            <span className="text-eyebrow opacity-70">
              {img.mime ? img.mime.split("/")[1] : "Image"}
            </span>
          </div>
        ) : (
          <img
            src={img.thumbUrl}
            alt={cleanTitle}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            onContextMenu={(e) => e.preventDefault()}
            className={cn(
              "h-full w-full object-cover transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-300",
              imageLoaded ? "opacity-100" : "opacity-0"
            )}
          />
        )}

        <div className="wikios-commons-card-overlay pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <div className="border-separator shadow-card rounded-full border bg-black/60 p-2 text-white">
            <ZoomIn className="h-4 w-4" />
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

export function CommonsResultsGrid({
  images,
  selectedImage,
  onSelect,
  onLoadMore,
  hasMore,
  isLoading,
  totalHits,
  isFilterActive,
  onClearFilters,
}: CommonsResultsGridProps) {
  if (images.length === 0 && isLoading) {
    return (
      <div className="wikios-commons-results">
        <ShimmerSkeletonGrid count={8} />
      </div>
    );
  }

  if (images.length === 0 && !isLoading) {
    if (isFilterActive) {
      return (
        <div className="wikios-commons-empty flex flex-col items-center justify-center p-12 text-center">
          <div className="bg-fill-4 text-label-secondary mb-3 rounded-full p-3">
            <ImageIcon className="h-6 w-6" />
          </div>
          <p className="text-body text-label mb-1 font-medium">No matching images found</p>
          <p className="text-footnote text-label-secondary mb-4 max-w-sm">
            No images match your active type or orientation filters. Try resetting filters to see
            all results.
          </p>
          {onClearFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearFilters}
              className="text-footnote border-separator hover:bg-fill-4"
            >
              <RefreshDouble className="mr-2 h-3.5 w-3.5" />
              Reset filters
            </Button>
          )}
        </div>
      );
    }

    return (
      <div className="wikios-commons-empty flex flex-col items-center justify-center p-12 text-center">
        <div className="bg-fill-4 text-label-secondary mb-3 rounded-full p-3">
          <ImageIcon className="h-6 w-6" />
        </div>
        <p className="text-body text-label mb-1 font-medium">Explore images</p>
        <p className="text-footnote text-label-secondary max-w-sm">
          Search for images using the search bar above or filter by type and orientation.
        </p>
      </div>
    );
  }

  return (
    <div className="wikios-commons-results">
      {totalHits != null && totalHits > 0 && (
        <div className="text-footnote text-label-secondary mb-3 flex items-center justify-between px-1">
          <span>
            Showing <strong className="text-label-secondary">{images.length}</strong> of{" "}
            <strong className="text-label-secondary">{totalHits.toLocaleString()}</strong> available
          </span>
        </div>
      )}

      <div className="wikios-commons-grid">
        {images.map((img) => (
          <CommonsCard
            key={img.pageid}
            img={img}
            isSelected={selectedImage?.pageid === img.pageid}
            onSelect={onSelect}
          />
        ))}
      </div>

      {isLoading && (
        <div className="mt-4">
          <ShimmerSkeletonGrid count={4} />
        </div>
      )}

      {hasMore && !isLoading && (
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
      )}
    </div>
  );
}
