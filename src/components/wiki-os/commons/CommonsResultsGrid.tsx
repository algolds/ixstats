"use client";

import { useState, useCallback, memo } from "react";
import { ZoomIn, MediaImage as ImageIcon, RefreshDouble } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { TextureOverlay } from "~/components/ui/texture-overlay";
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
        "focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none",
        "active:scale-[0.98] transition-all duration-200",
        isSelected && "wikios-commons-card--selected"
      )}
      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 200px" }}
    >
      <TextureOverlay texture="paperGrain" opacity={0.05} className="mix-blend-overlay" />
      <TextureOverlay texture="dots" opacity={0.03} className="mix-blend-overlay" />

      <div className="wikios-commons-card-thumb relative aspect-[4/3] w-full overflow-hidden bg-white/[0.03]">
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 animate-pulse bg-white/[0.04]" />
        )}

        {imageError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-3 text-center text-muted-foreground/60">
            <ImageIcon className="h-6 w-6 opacity-40" />
            <span className="text-[10px] font-medium tracking-wide uppercase opacity-70">
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
              "h-full w-full object-cover transition-all duration-300 group-hover:scale-105",
              imageLoaded ? "opacity-100" : "opacity-0"
            )}
          />
        )}

        <div className="wikios-commons-card-overlay pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 backdrop-blur-[2px] transition-opacity duration-200 group-hover:opacity-100">
          <div className="rounded-full border border-white/20 bg-black/60 p-2 text-white shadow-md">
            <ZoomIn className="h-4 w-4" />
          </div>
        </div>
      </div>

      <div className="wikios-commons-card-info flex flex-col gap-0.5 p-2.5">
        <span className="wikios-commons-card-title truncate text-[11px] font-medium text-[var(--wikios-text-muted)] group-hover:text-[var(--wikios-text)] transition-colors">
          {cleanTitle}
        </span>
        <div className="flex items-center justify-between text-[9px] text-[var(--wikios-text-dim)]">
          <span>
            {img.width > 0 && img.height > 0 ? `${img.width}×${img.height}` : "Vector"}
          </span>
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
          className="wikios-commons-card overflow-hidden border border-white/5 bg-white/[0.02]"
        >
          <div className="aspect-[4/3] w-full animate-pulse bg-white/[0.04]" />
          <div className="p-2.5 space-y-2">
            <div className="h-2.5 w-3/4 animate-pulse rounded bg-white/[0.05]" />
            <div className="h-2 w-1/3 animate-pulse rounded bg-white/[0.03]" />
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
          <div className="rounded-full bg-white/[0.04] p-3 text-muted-foreground/60 mb-3">
            <ImageIcon className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium text-[var(--wikios-text)] mb-1">
            No matching images found
          </p>
          <p className="text-xs text-[var(--wikios-text-dim)] max-w-sm mb-4">
            No images match your active type or orientation filters. Try resetting filters to see
            all results.
          </p>
          {onClearFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearFilters}
              className="text-xs border-white/10 hover:bg-white/5"
            >
              <RefreshDouble className="mr-1.5 h-3.5 w-3.5" />
              Reset Filters
            </Button>
          )}
        </div>
      );
    }

    return (
      <div className="wikios-commons-empty flex flex-col items-center justify-center p-12 text-center">
        <div className="rounded-full bg-white/[0.04] p-3 text-muted-foreground/60 mb-3">
          <ImageIcon className="h-6 w-6" />
        </div>
        <p className="text-sm font-medium text-[var(--wikios-text)] mb-1">
          Explore Sovereign Assets
        </p>
        <p className="text-xs text-[var(--wikios-text-dim)] max-w-sm">
          Search Wikimedia Commons, browse worldbuilding categories in the sidebar, or switch to
          IxWiki to find community uploads.
        </p>
      </div>
    );
  }

  return (
    <div className="wikios-commons-results">
      {totalHits != null && totalHits > 0 && (
        <div className="mb-3 flex items-center justify-between px-1 text-[10px] text-[var(--wikios-text-dim)]">
          <span>
            Showing <strong className="text-[var(--wikios-text-muted)]">{images.length}</strong> of{" "}
            <strong className="text-[var(--wikios-text-muted)]">
              {totalHits.toLocaleString()}
            </strong>{" "}
            available
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
            className="border-white/10 text-xs hover:bg-white/5 active:scale-95 transition-all"
          >
            Load more images
          </Button>
        </div>
      )}
    </div>
  );
}
