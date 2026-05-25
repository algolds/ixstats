"use client";

import { ZoomIn } from "lucide-react";
import { Button } from "~/components/ui/button";

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
}

export function CommonsResultsGrid({
  images,
  selectedImage,
  onSelect,
  onLoadMore,
  hasMore,
  isLoading,
}: CommonsResultsGridProps) {
  if (images.length === 0 && !isLoading) {
    return (
      <div className="wikios-commons-empty">
        <p>Search for images or browse a category to get started.</p>
      </div>
    );
  }

  return (
    <div className="wikios-commons-results">
      <div className="wikios-commons-grid">
        {images.map((img) => {
          const isSelected = selectedImage?.pageid === img.pageid;
          const cleanTitle = img.title.replace(/^File:/, "").replace(/_/g, " ");

          return (
            <button
              key={img.pageid}
              onClick={() => onSelect(img)}
              className={`wikios-commons-card ${isSelected ? "wikios-commons-card--selected" : ""}`}
            >
              <div className="wikios-commons-card-thumb">
                <img src={img.thumbUrl} alt={cleanTitle} loading="lazy" />
                <div className="wikios-commons-card-overlay">
                  <ZoomIn className="h-5 w-5" />
                </div>
              </div>
              <div className="wikios-commons-card-info">
                <span className="wikios-commons-card-title">{cleanTitle}</span>
                <span className="wikios-commons-card-meta">
                  {img.width}×{img.height}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {isLoading && <div className="wikios-commons-loading">Loading images...</div>}

      {hasMore && !isLoading && (
        <div className="wikios-commons-loadmore">
          <Button variant="ghost" size="sm" onClick={onLoadMore}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
