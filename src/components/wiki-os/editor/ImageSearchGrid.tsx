"use client";
// Visual image search with card tiles: IxWiki's files (`wikios.searchFiles`) and Wikimedia Commons
// (`commons.search`, paged, with each file's author and licence).

import { useState, useCallback, useRef, useEffect } from "react";
import {
  SystemRestart as Loader2,
  Xmark as X,
  OpenNewWindow as ExternalLink,
  Copy,
  Check,
  MediaImage as ImageIcon,
  Globe,
  Database,
  ZoomIn,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { BlurHashService } from "~/lib/wiki-os/core/blurhash-service";
import { getImageUrl } from "~/lib/wiki-os/transformers/image-url";
import { PlaceholderImage } from "~/components/wiki-os/shared/PlaceholderImage";
import { Button } from "~/components/ui/button";
import { SearchField } from "~/components/ui/search-field";
import { SegmentedControl } from "~/components/ui/segmented-control";
import {
  MIN_COMMONS_QUERY_LENGTH,
  useCommonsImageSearch,
} from "~/components/wiki-os/editor/hooks/useCommonsImageSearch";

interface ImageResult {
  title: string;
  url: string;
  thumbUrl?: string;
  width?: number;
  height?: number;
  mime?: string;
  /** Where the file lives: IxWiki's own files, or Wikimedia Commons (which IxWiki shows through InstantCommons). */
  source?: "ixwiki" | "commons";
  /** A Commons file's author, as Commons credits it. */
  artist?: string;
  /** A Commons file's licence (its short name, such as "CC BY-SA 4.0"). */
  license?: string;
  /** A Commons file's description page, where its full attribution is. */
  descriptionUrl?: string;
  /** An IxWiki file's BlurHash (WK-17), shown while the thumbnail loads. */
  blurhash?: string | null;
}

/** "CC BY-SA 4.0 · Jane Doe": the credit line of a Commons file, or null when Commons gave neither. */
export function attributionLine(image: Pick<ImageResult, "artist" | "license">): string | null {
  const parts = [image.license, image.artist].filter((part): part is string => !!part?.trim());
  return parts.length > 0 ? parts.join(" · ") : null;
}

type Tab = "ixwiki" | "commons";

interface ImageSearchGridProps {
  onSelect?: (image: ImageResult) => void;
  selectedImage?: ImageResult | null;
  compact?: boolean;
}

export function ImageSearchGrid({ onSelect, selectedImage, compact }: ImageSearchGridProps) {
  const [tab, setTab] = useState<Tab>("ixwiki");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedImage, setExpandedImage] = useState<ImageResult | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup debounce timer on unmount
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const handleSearch = useCallback((val: string) => {
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQuery(val), 400);
  }, []);

  const searched = debouncedQuery.trim().length >= MIN_COMMONS_QUERY_LENGTH;
  const ixwikiQuery = api.wikios.searchFiles.useQuery(
    { query: debouncedQuery, limit: 48 },
    { enabled: tab === "ixwiki" && searched, staleTime: 60000 }
  );
  const commons = useCommonsImageSearch(debouncedQuery, tab === "commons");

  const results: ImageResult[] =
    tab === "ixwiki"
      ? (ixwikiQuery.data ?? []).map((f: any) => ({
          title: f.title ?? f.name ?? "",
          url: f.url ?? getImageUrl(f.title ?? f.name ?? ""),
          thumbUrl: f.thumbUrl ?? f.url,
          width: f.width,
          height: f.height,
          mime: f.mime,
          source: "ixwiki" as const,
          blurhash: f.blurhash ?? null,
        }))
      : commons.results;

  const sourceName = tab === "ixwiki" ? "IxWiki" : "Wikimedia Commons";
  const isLoading = tab === "ixwiki" ? ixwikiQuery.isLoading : commons.isLoading;
  const hasError = tab === "ixwiki" ? ixwikiQuery.isError : commons.error !== null;
  const errorText =
    tab === "commons" && commons.error?.rateLimited
      ? "Too many Commons searches just now. Wait a minute, then try again."
      : `${sourceName} could not be searched.`;
  const retry = () => {
    if (tab === "ixwiki") void ixwikiQuery.refetch();
    else commons.retry();
  };
  const expandedCredit = expandedImage ? attributionLine(expandedImage) : null;

  const handleCopy = useCallback((img: ImageResult) => {
    const name = img.title.replace(/^File:/, "");
    navigator.clipboard.writeText(`[[File:${name}|thumb|Caption]]`);
    setCopiedId(img.url);
    setTimeout(() => setCopiedId(null), 1500);
  }, []);

  return (
    <div className={cn("wikios-imgs", compact && "wikios-imgs-compact")}>
      {/* Header bar: tabs and search in one row */}
      <div className="wikios-imgs-header">
        <SegmentedControl
          size="sm"
          aria-label="Image source"
          value={tab}
          onValueChange={(next) => {
            setTab(next);
            setExpandedImage(null);
          }}
          options={[
            { value: "ixwiki", label: "IxWiki", icon: <Database /> },
            { value: "commons", label: "Commons", icon: <Globe /> },
          ]}
        />
        <SearchField
          size="sm"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onClear={() => {
            setQuery("");
            setDebouncedQuery("");
          }}
          placeholder={tab === "ixwiki" ? "Search IxWiki files..." : "Search Wikimedia Commons..."}
          aria-label="Search images"
          containerClassName="min-w-0 flex-1"
        />
      </div>

      {/* Status line */}
      {searched && !isLoading && results.length > 0 && (
        <div className="wikios-imgs-status">
          {tab === "commons" && commons.totalHits !== null && commons.totalHits > results.length
            ? `${results.length} of ${commons.totalHits.toLocaleString()} images shown`
            : `${results.length} ${results.length === 1 ? "image" : "images"} found`}
          {` on ${sourceName}`}
        </div>
      )}

      {/* States */}
      {isLoading && searched && (
        <div className="wikios-imgs-state">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Searching {sourceName}...</span>
        </div>
      )}

      {!searched && (
        <div className="wikios-imgs-state wikios-imgs-empty-state">
          <div className="wikios-imgs-empty-icon">
            <ImageIcon className="h-9 w-9" />
          </div>
          <h3>Search for images</h3>
          <p>
            Find images from{" "}
            {tab === "ixwiki" ? "IxWiki's local uploads" : "Wikimedia Commons' free media library"}
          </p>
        </div>
      )}

      {hasError && searched && !isLoading && (
        <div role="alert" className="wikios-imgs-state">
          <span>{errorText}</span>
          <Button variant="secondary" size="sm" onClick={retry}>
            Try again
          </Button>
        </div>
      )}

      {!isLoading && !hasError && searched && results.length === 0 && (
        <div className="wikios-imgs-state">
          <ImageIcon className="h-6 w-6 opacity-30" />
          <span>No images found for &ldquo;{debouncedQuery}&rdquo;</span>
        </div>
      )}

      {/* Main content: grid and optional detail panel */}
      <div className="wikios-imgs-content">
        <div
          className={cn(
            "wikios-imgs-grid",
            compact ? "wikios-imgs-grid-sm" : "wikios-imgs-grid-lg"
          )}
        >
          {results.map((img) => {
            const isSelected = selectedImage?.url === img.url;
            const isExpanded = expandedImage?.url === img.url;
            return (
              <div
                key={img.title + img.url}
                className={cn(
                  "wikios-imgs-card",
                  isSelected && "wikios-imgs-card-selected",
                  isExpanded && "wikios-imgs-card-expanded"
                )}
                onClick={() => {
                  onSelect?.(img);
                  if (!compact) setExpandedImage(isExpanded ? null : img);
                }}
              >
                <div className="wikios-imgs-card-img">
                  <PlaceholderImage
                    placeholder={BlurHashService.placeholderDataUri(
                      img.blurhash,
                      img.width,
                      img.height
                    )}
                    src={img.thumbUrl ?? img.url}
                    alt={img.title}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                  <div className="wikios-imgs-card-overlay">
                    <ZoomIn className="h-4 w-4" />
                  </div>
                </div>
                <div className="wikios-imgs-card-footer">
                  <span className="wikios-imgs-card-name">
                    {img.title.replace(/^File:/, "").replace(/_/g, " ")}
                    {img.license && <span className="wikios-imgs-card-licence">{img.license}</span>}
                  </span>
                  <div className="wikios-imgs-card-actions">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Copy wikitext"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(img);
                      }}
                      title="Copy wikitext"
                      className="size-6"
                    >
                      {copiedId === img.url ? (
                        <Check className="text-green h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                    <Button asChild variant="ghost" size="icon-sm" className="size-6">
                      <a
                        href={img.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title="Open full size"
                        aria-label="Open full size"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
          {tab === "commons" &&
            results.length > 0 &&
            (commons.hasMore || commons.isLoadingMore) && (
              <div className="wikios-imgs-more">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={commons.isLoadingMore}
                  onClick={commons.loadMore}
                >
                  {commons.isLoadingMore ? "Loading..." : "Load more images"}
                </Button>
              </div>
            )}
        </div>

        {/* Detail panel: shows when an image is expanded (standalone page only) */}
        {!compact && expandedImage && (
          <div className="wikios-imgs-detail">
            <Button
              variant="secondary"
              size="icon-sm"
              aria-label="Close details"
              onClick={() => setExpandedImage(null)}
              className="absolute top-2 right-2 z-10 rounded-full"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
            <div className="wikios-imgs-detail-preview">
              <img src={expandedImage.url} alt={expandedImage.title} referrerPolicy="no-referrer" />
            </div>
            <div className="wikios-imgs-detail-info">
              <h3>{expandedImage.title.replace(/^File:/, "").replace(/_/g, " ")}</h3>
              <div className="wikios-imgs-detail-meta">
                {(expandedImage.width ?? 0) > 0 && (expandedImage.height ?? 0) > 0 && (
                  <span>
                    {expandedImage.width} × {expandedImage.height} px
                  </span>
                )}
                {expandedImage.mime && <span>{expandedImage.mime}</span>}
              </div>
              {expandedImage.source === "commons" && (
                <p className="wikios-imgs-attribution">
                  From Wikimedia Commons{expandedCredit ? `: ${expandedCredit}` : ""}.{" "}
                  {expandedImage.descriptionUrl && (
                    <a
                      href={expandedImage.descriptionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Full attribution
                    </a>
                  )}
                </p>
              )}
              <div className="wikios-imgs-detail-actions">
                <Button size="sm" onClick={() => handleCopy(expandedImage)}>
                  {copiedId === expandedImage.url ? (
                    <>
                      <Check className="h-3 w-3" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" /> Copy wikitext
                    </>
                  )}
                </Button>
                <Button asChild variant="secondary" size="sm">
                  <a href={expandedImage.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3" /> View full size
                  </a>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export type { ImageResult };
